<?php
declare(strict_types=1);
$config=tempnam(sys_get_temp_dir(),'yuganth-rzp-');file_put_contents($config,"<?php return ['dsn'=>'sqlite::memory:','checkout_enabled'=>true,'catalog_verified'=>true,'payment_driver'=>'manual_test','serviceable_pincodes'=>['530028']];");putenv('YUGANTH_CONFIG_FILE='.$config);register_shutdown_function(fn()=>unlink($config));
require dirname(__DIR__).'/app/bootstrap.php';require dirname(__DIR__).'/app/Database.php';require dirname(__DIR__).'/app/Razorpay.php';
use function Yuganth\{query,one,rows,uid,now,migrate,seed,createOrder,getOrder,confirmPayment,cancelOrder};
use Yuganth\{RazorpayGateway,ApiError};
$checks=0;function check(bool $v,string $label):void{global $checks;if(!$v)throw new RuntimeException($label);$checks++;}
function rejects(callable $fn,int $code,string $label):void{try{$fn();}catch(ApiError $e){check($e->status===$code,$label);return;}throw new RuntimeException($label.' accepted');}
migrate();seed();$u=uid();query('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)',[$u,'Test','test@example.test','not-a-login',now()]);query('UPDATE variants SET stock=100,price_paise=25000,price_confirmed=1');
$input=['items'=>[['variant_id'=>'guntur-gold-500','quantity'=>1]],'address'=>['name'=>'Tester','phone'=>'9618423444','line1'=>'Test only','city'=>'Vizag','state'=>'Andhra Pradesh','pincode'=>'530028']];
$settings=['razorpay_mode'=>'test','razorpay_key_id'=>'rzp_test_Synthetic','razorpay_key_secret'=>'synthetic-api-secret','razorpay_webhook_secret'=>'synthetic-webhook-secret','environment'=>'development','razorpay_live_enabled'=>false];
$remoteOrders=[];$remotePayments=[];$creates=0;$failCreate=false;
$transport=function($method,$path,$body)use(&$remoteOrders,&$remotePayments,&$creates,&$failCreate){
 if($method==='POST'){$creates++;if($failCreate)throw new ApiError(502,'Synthetic timeout');$id='order_Test'.$creates;return $remoteOrders[$id]=['id'=>$id,...$body,'status'=>'created','amount_paid'=>0];}
 if(str_starts_with($path,'payments/'))return $remotePayments[substr($path,9)];return $remoteOrders[substr($path,7)];
};
$g=new RazorpayGateway($settings,$transport);
rejects(fn()=>new RazorpayGateway([...$settings,'razorpay_key_id'=>'rzp_live_Unexpected'],$transport),503,'mode mismatch');
rejects(fn()=>new RazorpayGateway([...$settings,'environment'=>'production'],$transport),503,'test keys blocked in production');
rejects(fn()=>new RazorpayGateway([...$settings,'razorpay_mode'=>'live','razorpay_key_id'=>'rzp_live_Synthetic'],$transport),503,'live disabled');
rejects(fn()=>new RazorpayGateway([...$settings,'razorpay_webhook_secret'=>''],$transport),503,'missing webhook secret');
$o=createOrder($u,$input,uid());$checkout=$g->createCheckout($o);$provider=$checkout['order_id'];
check($checkout['amount']===31000,'server-calculated total');check(!isset($checkout['key_secret'])&&!str_contains(json_encode($checkout),$settings['razorpay_key_secret']),'no secret in checkout');
check($g->createCheckout($o)['order_id']===$provider&&$creates===1,'provider order reused');
$payment='pay_Test1';$reply=['razorpay_order_id'=>$provider,'razorpay_payment_id'=>$payment,'razorpay_signature'=>hash_hmac('sha256',$provider.'|'.$payment,$settings['razorpay_key_secret'])];
rejects(fn()=>$g->verifyCheckout($o,[...$reply,'razorpay_signature'=>str_repeat('0',64)]),400,'forged signature');
rejects(fn()=>$g->verifyCheckout($o,[...$reply,'razorpay_order_id'=>'order_Wrong']),400,'client order substitution');
$remotePayments[$payment]=['id'=>$payment,'order_id'=>$provider,'currency'=>'INR','amount'=>31000,'status'=>'authorized','captured'=>false];
rejects(fn()=>$g->verifyCheckout($o,$reply),409,'authorization alone not fulfillment');
$remotePayments[$payment]['status']='captured';$remotePayments[$payment]['captured']=true;$remoteOrders[$provider]['status']='paid';$remoteOrders[$provider]['amount_paid']=31000;
$remotePayments[$payment]['amount']=1;rejects(fn()=>$g->verifyCheckout($o,$reply),409,'amount mismatch');$remotePayments[$payment]['amount']=31000;
$remoteOrders[$provider]['receipt']='wrong';rejects(fn()=>$g->verifyCheckout($o,$reply),409,'receipt mapping mismatch');$remoteOrders[$provider]['receipt']=$o['id'];
$remotePayments[$payment]['currency']='USD';rejects(fn()=>$g->verifyCheckout($o,$reply),409,'currency mismatch');$remotePayments[$payment]['currency']='INR';
$raw=json_encode(['event'=>'payment.captured','payload'=>['payment'=>['entity'=>['id'=>$payment,'order_id'=>$provider]]]],JSON_THROW_ON_ERROR);$headers=['X-Razorpay-Signature'=>hash_hmac('sha256',$raw,$settings['razorpay_webhook_secret'])];
rejects(fn()=>$g->verifyCapturedWebhook($raw,['X-Razorpay-Signature'=>'bad']),400,'webhook signature');
rejects(fn()=>$g->verifyCapturedWebhook($raw.' ',$headers),400,'raw body tamper');
$verified=$g->verifyCheckout($o,$reply);check(confirmPayment($verified)['status']==='processing','captured checkout confirms order');
$webhook=$g->verifyCapturedWebhook($raw,$headers);check($webhook['event_id']===$verified['event_id'],'callback and webhook same idempotency key');check(confirmPayment($webhook)['status']==='processing','duplicate webhook accepted');check(count(rows('SELECT * FROM outbox'))===1,'one notification for duplicate confirmations');
$ignored=json_encode(['event'=>'payment.failed']);check(isset($g->verifyCapturedWebhook($ignored,['x-razorpay-signature'=>hash_hmac('sha256',$ignored,$settings['razorpay_webhook_secret'])])['ignored']),'non-capture ignored');
$two=createOrder($u,$input,uid());$c2=$g->createCheckout($two);$other=[...$reply,'razorpay_signature'=>hash_hmac('sha256',$c2['order_id'].'|'.$payment,$settings['razorpay_key_secret']),'razorpay_order_id'=>$c2['order_id']];rejects(fn()=>$g->verifyCheckout($two,$other),409,'payment cannot fulfill another order');
$three=createOrder($u,$input,uid());$failCreate=true;rejects(fn()=>$g->createCheckout($three),502,'provider timeout');$count=$creates;rejects(fn()=>$g->createCheckout($three),409,'uncertain creation blocked');check($creates===$count,'no duplicate provider create after timeout');$failCreate=false;
$four=createOrder($u,$input,uid());cancelOrder($four['id'],$u);rejects(fn()=>$g->createCheckout($four),409,'cancelled reservation blocked');
$changed=new RazorpayGateway([...$settings,'razorpay_key_id'=>'rzp_test_Other'],$transport);rejects(fn()=>$changed->createCheckout($two),409,'key rotation cannot reuse old provider order');
echo "PASS: $checks Razorpay assertions\n";
