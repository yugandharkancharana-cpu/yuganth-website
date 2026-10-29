<?php
declare(strict_types=1);
namespace Yuganth;

/** Standard Checkout: keys stay on the server; only captured, API-verified payments fulfill orders. */
final class RazorpayGateway implements PaymentGateway
{
    private array $settings;
    private ?\Closure $transport;
    // An injected transport is for isolated tests only; there is no configurable API URL.
    public function __construct(array $settings, ?\Closure $transport=null)
    {
        $mode=$settings['razorpay_mode']??'test';$key=$settings['razorpay_key_id']??'';
        if(!in_array($mode,['test','live'],true)||!is_string($key)||!preg_match('/^rzp_'.preg_quote($mode,'/').'_[A-Za-z0-9]+$/D',$key)||!is_string($settings['razorpay_key_secret']??null)||strlen($settings['razorpay_key_secret'])<12)throw new ApiError(503,'Razorpay keys are missing or do not match the selected mode.');
        if($mode==='live'&&(($settings['environment']??'')!=='production'||($settings['razorpay_live_enabled']??false)!==true))throw new ApiError(503,'Live payments have not been enabled.');
        if($mode==='test'&&($settings['environment']??'')==='production')throw new ApiError(503,'Test keys cannot be used in production.');
        if(!is_string($settings['razorpay_webhook_secret']??null)||strlen($settings['razorpay_webhook_secret'])<16)throw new ApiError(503,'Configure a separate Razorpay webhook secret of at least 16 characters.');
        $this->settings=$settings;$this->transport=$transport;
    }
    private function request(string $method,string $path,?array $body=null): array
    {
        if($this->transport)return ($this->transport)($method,$path,$body);
        if(!function_exists('curl_init'))throw new ApiError(503,'Enable PHP cURL for Razorpay.');
        $ch=curl_init('https://api.razorpay.com/v1/'.$path);
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_USERPWD=>$this->settings['razorpay_key_id'].':'.$this->settings['razorpay_key_secret'],CURLOPT_HTTPAUTH=>CURLAUTH_BASIC,CURLOPT_HTTPHEADER=>['Accept: application/json','Content-Type: application/json'],CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>25,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
        if($body!==null)curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR));
        $raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
        // Never disclose provider responses, credentials or customer details in public errors.
        if($raw===false||$status<200||$status>=300)throw new ApiError(502,'Razorpay could not complete the request. Check your order status before retrying.');
        try{$result=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}catch(\JsonException $e){throw new ApiError(502,'Invalid payment provider response.');}
        if(!is_array($result))throw new ApiError(502,'Invalid payment provider response.');return $result;
    }
    public function createCheckout(array $order): array
    {
        // Reserve the provider attempt before network I/O. An uncertain create must never be retried automatically.
        $mapping=transaction(function()use($order){
            $o=one('SELECT * FROM orders WHERE id=?'.lockSuffix(),[$order['id']]);
            if(!$o||$o['status']!=='pending_payment'||(int)$o['expires_at']<=now())throw new ApiError(409,'Order is no longer payable.');
            $row=one('SELECT * FROM razorpay_orders WHERE order_id=?',[$o['id']]);
            if($row){if($row['key_id']!==$this->settings['razorpay_key_id'])throw new ApiError(409,'Payment configuration changed. Contact support about this reservation.');if($row['state']!=='ready')throw new ApiError(409,'Payment setup is pending reconciliation. Contact support before retrying.');return $row;}
            query('INSERT INTO razorpay_orders (order_id,key_id,state,created_at) VALUES (?,?,?,?)',[$o['id'],$this->settings['razorpay_key_id'],'creating',now()]);return null;
        });
        if(!$mapping){
            try{
                $remote=$this->request('POST','orders',['amount'=>(int)$order['total_paise'],'currency'=>'INR','receipt'=>$order['id'],'partial_payment'=>false,'notes'=>['yuganth_order_id'=>$order['id']]]);
                $provider=$remote['id']??'';
                if(!is_string($provider)||!preg_match('/^order_[A-Za-z0-9]+$/D',$provider))throw new ApiError(502,'Invalid provider order.');
                $this->validateOrder($remote,$order);
                query('UPDATE razorpay_orders SET provider_order_id=?,state=? WHERE order_id=?',[$provider,'ready',$order['id']]);
                $mapping=['provider_order_id'=>$provider];
            }catch(\Throwable $e){query('UPDATE razorpay_orders SET state=? WHERE order_id=?',['uncertain',$order['id']]);throw $e;}
        }
        $current=one('SELECT status,expires_at FROM orders WHERE id=?',[$order['id']]);
        if(!$current||$current['status']!=='pending_payment'||(int)$current['expires_at']<=now())throw new ApiError(409,'Reservation expired. Do not start payment.');
        return ['mode'=>'razorpay','key'=>$this->settings['razorpay_key_id'],'order_id'=>$mapping['provider_order_id'],'amount'=>(int)$order['total_paise'],'currency'=>'INR','name'=>'Yuganth','description'=>'Yuganth order '.$order['id']];
    }
    private function validateOrder(array $remote,array $local): void
    {
        if(($remote['receipt']??'')!==$local['id']||($remote['notes']['yuganth_order_id']??'')!==$local['id']||($remote['currency']??'')!=='INR'||!isset($remote['amount'])||!is_int($remote['amount'])||$remote['amount']!==(int)$local['total_paise'])throw new ApiError(409,'Payment order mapping or amount mismatch.');
    }
    private function captured(string $paymentId,string $providerOrder): array
    {
        if(!preg_match('/^pay_[A-Za-z0-9]+$/D',$paymentId)||!preg_match('/^order_[A-Za-z0-9]+$/D',$providerOrder))throw new ApiError(422,'Invalid payment reference.');
        $mapping=one('SELECT * FROM razorpay_orders WHERE provider_order_id=? AND state=?',[$providerOrder,'ready']);
        if(!$mapping||$mapping['key_id']!==$this->settings['razorpay_key_id'])throw new ApiError(409,'Unknown payment order.');
        $local=getOrder($mapping['order_id']);
        // Fetch with this merchant's credentials, verifying both entities independently of browser/webhook data.
        $payment=$this->request('GET','payments/'.$paymentId);$remote=$this->request('GET','orders/'.$providerOrder);
        $this->validateOrder($remote,$local);
        if(($remote['id']??'')!==$providerOrder||($payment['id']??'')!==$paymentId||($payment['order_id']??'')!==$providerOrder||($payment['currency']??'')!=='INR'||($payment['status']??'')!=='captured'||($payment['captured']??false)!==true||!is_int($payment['amount']??null)||$payment['amount']!==(int)$local['total_paise']||($remote['status']??'')!=='paid'||($remote['amount_paid']??null)!==(int)$local['total_paise'])throw new ApiError(409,'Payment is not captured or its amount does not match. Check order status before retrying.');
        return ['event_id'=>'razorpay:'.$paymentId,'order_id'=>$local['id'],'amount_paise'=>$payment['amount'],'currency'=>'INR'];
    }
    public function verifyCheckout(array $order,array $input): array
    {
        $mapping=one('SELECT * FROM razorpay_orders WHERE order_id=? AND state=?',[$order['id'],'ready']);
        $payment=text($input['razorpay_payment_id']??null,80,'payment ID');$signature=text($input['razorpay_signature']??null,64,'signature',64);
        if(!$mapping||$mapping['key_id']!==$this->settings['razorpay_key_id']||($input['razorpay_order_id']??'')!==$mapping['provider_order_id']||!hash_equals(hash_hmac('sha256',$mapping['provider_order_id'].'|'.$payment,$this->settings['razorpay_key_secret']),$signature))throw new ApiError(400,'Payment signature verification failed.');
        return $this->captured($payment,$mapping['provider_order_id']);
    }
    public function verifyCapturedWebhook(string $rawBody,array $headers): array
    {
        $headers=array_change_key_case($headers,CASE_LOWER);$signature=$headers['x-razorpay-signature']??'';
        if(!is_string($signature)||!hash_equals(hash_hmac('sha256',$rawBody,$this->settings['razorpay_webhook_secret']),$signature))throw new ApiError(400,'Webhook signature verification failed.');
        try{$event=json_decode($rawBody,true,32,JSON_THROW_ON_ERROR);}catch(\JsonException $e){throw new ApiError(400,'Invalid webhook.');}
        if(!is_array($event))throw new ApiError(400,'Invalid webhook.');
        if(!in_array($event['event']??'',['payment.captured','order.paid'],true))return ['ignored'=>true];
        $payment=$event['payload']['payment']['entity']??[];
        return $this->captured(text($payment['id']??null,80,'payment ID'),text($payment['order_id']??null,80,'provider order'));
    }
}
