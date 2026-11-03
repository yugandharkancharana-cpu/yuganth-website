<?php
declare(strict_types=1);
// Additive endpoint: the live API and its private configuration are not replaced.
$root=dirname(__DIR__,2);
$bootstrap=is_file($root.'/yuganth-app/app/bootstrap.php')?$root.'/yuganth-app/app/bootstrap.php':$root.'/app/bootstrap.php';
require $bootstrap;
use function Yuganth\{config,sessionStart,throttle,one,query,uid,now,text,createOrder,getOrder,cancelOrder,gateway,confirmPayment};
use Yuganth\ApiError;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
function guestReply(array $data,int $status=200):never{http_response_code($status);echo json_encode($data,JSON_THROW_ON_ERROR);exit;}
try{
 sessionStart();
 $method=$_SERVER['REQUEST_METHOD']??'GET';$route=$_GET['route']??'';
 if(!is_string($route)||!in_array($method,['GET','POST'],true))throw new ApiError(404,'Not found.');
 $input=[];
 if($method==='POST'){
  if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))throw new ApiError(415,'Use application/json.');
  if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new ApiError(419,'Your session expired. Refresh before continuing.');
  $raw=file_get_contents('php://input',false,null,0,65537);
  if(strlen($raw)>65536)throw new ApiError(413,'Request too large.');
  try{$input=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}catch(\JsonException $e){throw new ApiError(400,'Invalid request.');}
  if(!is_array($input)||array_is_list($input)&&$input!==[])throw new ApiError(400,'JSON object required.');
 }
 // Guest identity lives only in the protected server session. Never accept an owner ID from a client.
 $guestId=$_SESSION['guest_checkout_id']??null;
 if($guestId&&!one("SELECT id FROM users WHERE id=? AND role='guest'",[$guestId]))$guestId=null;
 if($route==='/orders'&&$method==='POST'){
  throttle('guest-checkout',12,3600);
  if(($input['terms_accepted']??false)!==true||($input['terms_version']??'')!=='2026-11-03')throw new ApiError(422,'Please accept the purchase terms before ordering.');
  // A guest row is an internal order owner, not a registered customer account.
  // It has no usable password and is never assigned to the signed-in user session.
  if(!$guestId){
   $guestId=uid();
   query("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)",[$guestId,'Guest customer','guest-'.$guestId.'@guest.yuganth.invalid',password_hash(bin2hex(random_bytes(48)),PASSWORD_DEFAULT),'guest',now()]);
   session_regenerate_id(true);$_SESSION['guest_checkout_id']=$guestId;
  }
  $order=createOrder($guestId,$input,$_SERVER['HTTP_IDEMPOTENCY_KEY']??'');
  $record='order_terms_'.$order['id'];
  if(!one('SELECT name FROM settings WHERE name=?',[$record])){
   try{query('INSERT INTO settings (name,value) VALUES (?,?)',[$record,json_encode(['version'=>'2026-11-03','accepted_at'=>now(),'order_id'=>$order['id']],JSON_THROW_ON_ERROR)]);}
   catch(\PDOException $e){if(!in_array((string)$e->getCode(),['23000','23505'],true))throw $e;}
  }
  guestReply(['order'=>$order],201);
 }
 if(!$guestId)throw new ApiError(401,'This guest session has expired. Contact support with your order reference before paying again.');
 if(!preg_match('~^/orders/([a-f0-9]{32})(/payment|/payment/verify|/cancel)?$~',$route,$m))throw new ApiError(404,'Not found.');
 $order=getOrder($m[1],$guestId);$action=$m[2]??'';
 if($method==='GET'&&$action==='')guestReply(['order'=>$order]);
 if($method==='POST'&&$action==='/cancel'){cancelOrder($order['id'],$guestId);guestReply(['order'=>getOrder($order['id'],$guestId)]);}
 if($method==='POST'&&$action==='/payment/verify'){
  throttle('guest-payment-verify',40);
  $g=gateway();if(!($g instanceof \Yuganth\RazorpayGateway))throw new ApiError(503,'Payment is temporarily unavailable.');
  guestReply(['order'=>confirmPayment($g->verifyCheckout($order,$input))]);
 }
 if($method==='POST'&&$action==='/payment'){
  if(!config()['checkout_enabled']||!config()['catalog_verified'])throw new ApiError(503,'Checkout is temporarily unavailable.');
  if($order['status']!=='pending_payment'||(int)$order['expires_at']<=now())throw new ApiError(409,'This reservation is no longer payable.');
  if((config()['delivery_mode']??'list')==='shiprocket_four_states'){
   require_once dirname($bootstrap).'/Delivery.php';
   \Yuganth\checkDelivery($order['address']['pincode'],$order['items'],$order['address']['state']);
  }
  guestReply(['checkout'=>gateway()->createCheckout($order)]);
 }
 throw new ApiError(404,'Not found.');
}catch(ApiError $e){guestReply(['error'=>$e->getMessage()],$e->status);}
catch(\Throwable $e){error_log('Yuganth guest checkout: '.get_class($e));guestReply(['error'=>'Guest checkout is temporarily unavailable. Please try again or contact support.'],503);}
