<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/app/bootstrap.php';
require dirname(__DIR__).'/app/ResetEmail.php';
// A lock prevents overlapping cron workers from sending the same batch concurrently.
$lock=fopen(dirname(__DIR__).'/storage/reset-mail.lock','c');
if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){fwrite(STDERR,"Email worker already running or lock unavailable.\n");exit(1);}
$sent=0;$failed=0;
foreach(\Yuganth\rows("SELECT * FROM outbox WHERE kind='auth.reset' AND delivered_at IS NULL AND attempts<10 ORDER BY created_at LIMIT 20") as $m){
    try{
        // Do not email expired links; never consume order or WhatsApp jobs.
        if((int)$m['created_at']+1800>time()){
            \Yuganth\resetEmail(json_decode($m['payload'],true,32,JSON_THROW_ON_ERROR),$m['id']);$sent++;
        }
        \Yuganth\query('UPDATE outbox SET delivered_at=?,attempts=attempts+1,last_error=NULL WHERE id=?',[time(),$m['id']]);
    }catch(Throwable $e){$failed++;\Yuganth\query('UPDATE outbox SET attempts=attempts+1,last_error=? WHERE id=?',['Reset email delivery failed. Check private mail settings.',$m['id']]);}
}
flock($lock,LOCK_UN);fclose($lock);
echo "Reset email batch: $sent accepted by SMTP; $failed failed.\n";
exit($failed?1:0);
