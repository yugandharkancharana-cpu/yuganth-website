<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') { http_response_code(404);exit; }
require dirname(__DIR__).'/app/bootstrap.php';
require dirname(__DIR__).'/app/Database.php';
use function Yuganth\{config,db,query,one,rows,uid,now,text,migrate,seed,cancelOrder};
$command=$argv[1]??'help';
try{
    if($command==='install'){
        $storage=dirname(__DIR__).'/storage';if(!is_dir($storage))mkdir($storage,0700,true);
        migrate();seed();echo "Schema installed; illustrative products seeded with ZERO stock. Verify all prices before enabling checkout.\n";
    }elseif($command==='admin'){
        $email=strtolower(trim($argv[2]??''));if(!filter_var($email,FILTER_VALIDATE_EMAIL))throw new RuntimeException('Usage: php bin/console.php admin email@example.com');
        // Supply through environment/secure terminal, never as a command-line argument.
        $password=getenv('YUGANTH_ADMIN_PASSWORD');if(!$password||strlen($password)<12||strlen($password)>72)throw new RuntimeException('Set YUGANTH_ADMIN_PASSWORD to a unique 12–72 byte password before running.');
        if(one('SELECT id FROM users WHERE email=?',[$email]))throw new RuntimeException('Email exists. No account was promoted or overwritten.');
        query('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',[uid(),'Yuganth administrator',$email,password_hash($password,PASSWORD_DEFAULT),'admin',now()]);echo "Administrator created. Unset YUGANTH_ADMIN_PASSWORD.\n";
    }elseif($command==='expire'){
        $n=0;foreach(rows("SELECT id FROM orders WHERE status='pending_payment' AND expires_at<=?",[now()]) as $o){cancelOrder($o['id'],'system',true);$n++;}
        query('DELETE FROM rate_limits WHERE expires_at<?',[now()]);query('DELETE FROM password_resets WHERE expires_at<?',[now()]);echo "Expired $n reservations.\n";
    }elseif($command==='outbox'){
        // Single worker via Hostinger cron/flock. Adapter manages provider idempotency.
        $file=getenv('YUGANTH_NOTIFICATION_ADAPTER');if(!$file||!is_file($file))throw new RuntimeException('Configure YUGANTH_NOTIFICATION_ADAPTER. No notifications have been sent.');
        $sender=require $file;if(!($sender instanceof \Yuganth\NotificationSender))throw new RuntimeException('Adapter must implement NotificationSender.');
        foreach(rows('SELECT * FROM outbox WHERE delivered_at IS NULL AND attempts<10 ORDER BY created_at LIMIT 50') as $message){
            try{$sender->deliver($message['id'],$message['kind'],json_decode($message['payload'],true,32,JSON_THROW_ON_ERROR));query('UPDATE outbox SET delivered_at=?,attempts=attempts+1,last_error=NULL WHERE id=?',[now(),$message['id']]);}
            catch(Throwable $e){query('UPDATE outbox SET attempts=attempts+1,last_error=? WHERE id=?',['Transport failed; inspect private provider logs.',$message['id']]);}
        }echo "Outbox batch processed.\n";
    }else echo "Commands: install | admin EMAIL | expire | outbox\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
