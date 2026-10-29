<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
require dirname(__DIR__).'/app/ResetEmail.php';
$path=dirname(__DIR__).'/config/mail.local.php';
if(is_file($path))throw new RuntimeException('Refusing to replace existing mail configuration.');
file_put_contents($path,"<?php return ['host'=>'smtp.example.test','port'=>465,'username'=>'fake','password'=>'fake','from'=>'hello@example.test'];");
$checks=0;
try{
    $payload=['email'=>'customer@example.test','url'=>rtrim(\Yuganth\config()['base_url'],'/').'/account.html#reset='.str_repeat('a',64)];
    $sent=false;
    \Yuganth\resetEmail($payload,str_repeat('b',32),function($c,$to,$mail)use(&$sent){
        if($to!=='customer@example.test'||!str_contains($mail,'Content-Transfer-Encoding: base64'))throw new RuntimeException('Mail format failed.');
        $body=base64_decode(explode("\r\n\r\n",$mail,2)[1]);
        if(!str_contains($body,'account.html#reset=')||!str_contains($body,'30 minutes'))throw new RuntimeException('Reset message failed.');
        $sent=true;
    });
    if(!$sent)throw new RuntimeException('Transport not invoked.');$checks++;
    foreach([
        ['email'=>"customer@example.test\r\nBcc: attacker@example.test"],
        ['url'=>'https://attacker.example/account.html#reset='.str_repeat('a',64)],
        ['url'=>rtrim(\Yuganth\config()['base_url'],'/').'/account.html#reset=invalid'],
    ] as $change){$blocked=false;try{\Yuganth\resetEmail(array_replace($payload,$change),str_repeat('b',32),fn()=>throw new RuntimeException('Unsafe transport invoked.'));}catch(RuntimeException $e){if($e->getMessage()==='Unsafe transport invoked.')throw $e;$blocked=true;}if(!$blocked)throw new RuntimeException('Unsafe mail accepted.');$checks++;}
    echo "PASS: $checks reset-email assertions (mock transport; no email sent).\n";
}finally{unlink($path);}
