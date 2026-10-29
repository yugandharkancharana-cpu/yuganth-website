<?php
declare(strict_types=1);
namespace Yuganth;

// Transactional password-reset mail only. Order/WhatsApp notifications use their own adapter.
function resetEmail(array $payload, string $messageId, ?callable $transport=null): void
{
    $path=dirname(__DIR__).'/config/mail.local.php';
    if(!is_file($path))throw new \RuntimeException('Configure private config/mail.local.php first.');
    $c=require $path;
    foreach(['from','username','password','host','port'] as $key)if(empty($c[$key]))throw new \RuntimeException('Mail configuration is incomplete.');
    $to=$payload['email']??'';$url=$payload['url']??'';
    if(!filter_var($to,FILTER_VALIDATE_EMAIL)||!filter_var($c['from'],FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$to.$c['from']))throw new \RuntimeException('Invalid mail address.');
    $base=rtrim(config()['base_url'],'/').'/account.html#reset=';
    if(!str_starts_with($url,$base)||!preg_match('/^[a-f0-9]{64}$/D',substr($url,strlen($base))))throw new \RuntimeException('Invalid reset URL.');
    if(!preg_match('/^[a-z0-9.-]+$/iD',$c['host'])||!in_array((int)$c['port'],[465,587],true))throw new \RuntimeException('Use a secure SMTP host and port 465 or 587.');
    if(!preg_match('/^[a-f0-9]{32}$/D',$messageId))throw new \RuntimeException('Invalid message ID.');
    $domain=substr(strrchr($c['from'],'@'),1);
    $mail='From: Yuganth <'.$c['from'].">\r\nTo: <".$to.">\r\nSubject: Reset your Yuganth password\r\nDate: ".gmdate('D, d M Y H:i:s +0000')."\r\nMessage-ID: <".$messageId.'@'.$domain.">\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $body="Hello,\n\nUse this link to choose a new Yuganth password:\n".$url."\n\nThe link expires 30 minutes after your request and can be used once. If you did not request this, you can ignore this email.\n\nYuganth\n";
    $mail.=chunk_split(base64_encode($body),76,"\r\n");
    if($transport){$transport($c,$to,$mail);return;}
    if(!extension_loaded('curl'))throw new \RuntimeException('Enable PHP cURL for email.');
    $stream=fopen('php://temp','w+');fwrite($stream,$mail);rewind($stream);
    $ch=curl_init(((int)$c['port']===465?'smtps://':'smtp://').$c['host'].':'.(int)$c['port']);
    try{
        curl_setopt_array($ch,[CURLOPT_USERNAME=>$c['username'],CURLOPT_PASSWORD=>$c['password'],CURLOPT_MAIL_FROM=>$c['from'],CURLOPT_MAIL_RCPT=>[$to],CURLOPT_UPLOAD=>true,CURLOPT_INFILE=>$stream,CURLOPT_INFILESIZE=>strlen($mail),CURLOPT_USE_SSL=>CURLUSESSL_ALL,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>25,CURLOPT_RETURNTRANSFER=>true]);
        if(curl_exec($ch)===false||curl_getinfo($ch,CURLINFO_RESPONSE_CODE)!==250)throw new \RuntimeException('SMTP delivery was not accepted. Check private mail settings.');
    }finally{curl_close($ch);fclose($stream);}
}
