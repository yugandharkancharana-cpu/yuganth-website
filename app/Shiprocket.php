<?php
declare(strict_types=1);
namespace Yuganth;

function shiprocketConfig(): array {
    $c=require dirname(__DIR__).'/config/shiprocket.example.php';
    $path=dirname(__DIR__).'/config/shiprocket.local.php';
    return is_file($path)?array_replace($c,require $path):$c;
}
function parcelPreset(array $items): ?array {
    if(count($items)!==1||(int)$items[0]['quantity']!==1)return null;
    return match((int)$items[0]['weight_g']) {
        500=>['length'=>24,'breadth'=>20,'height'=>3,'weight'=>0.505],
        1000=>['length'=>27,'breadth'=>25,'height'=>5,'weight'=>1.005],
        default=>null
    };
}
function shiprocketPayload(array $order,array $parcel,string $email,string $pickup): array {
    if (isset($order['address']['distributor'])) throw new ApiError(409, 'Arrange distributor delivery separately after checking the phone quote.');
    if($order['status']!=='processing')throw new ApiError(409,'Only payment-confirmed orders can be sent to Shiprocket.');
    $netWeight=0;foreach($order['items'] as $item)$netWeight+=(int)$item['weight_g']*(int)$item['quantity'];
    foreach(['length','breadth','height','weight'] as $key){$v=$parcel[$key]??null;if(!is_numeric($v)||!is_finite((float)$v)||(float)$v<=($key==='weight'?0:0.5)||(float)$v>($key==='weight'?100:300))throw new ApiError(422,'Enter valid parcel dimensions in cm and packed weight in kg.');$parcel[$key]=(float)$v;}
    if($parcel['weight']*1000<$netWeight)throw new ApiError(422,'Packed weight cannot be less than the products inside.');
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)||trim($pickup)==='')throw new ApiError(422,'Customer email and saved pickup name are required.');
    $a=$order['address'];$names=explode(' ',trim($a['name']),2);
    return array_merge([
        'order_id'=>$order['id'],'order_date'=>gmdate('Y-m-d H:i',(int)$order['created_at']),
        'pickup_location'=>$pickup,'billing_customer_name'=>$names[0],'billing_last_name'=>$names[1]??'',
        'billing_address'=>$a['line1'],'billing_address_2'=>$a['line2']??'',
        'billing_city'=>$a['city'],'billing_pincode'=>$a['pincode'],'billing_state'=>$a['state'],
        'billing_country'=>'India','billing_email'=>$email,'billing_phone'=>$a['phone'],
        'shipping_is_billing'=>true,'payment_method'=>'Prepaid',
        'order_items'=>array_map(fn($i)=>['name'=>$i['name'],'sku'=>$i['variant_id'],'units'=>(int)$i['quantity'],'selling_price'=>(int)$i['unit_paise']/100],$order['items']),
        'sub_total'=>(int)$order['subtotal_paise']/100,'total_discount'=>(int)$order['discount_paise']/100,
        'shipping_charges'=>(int)$order['shipping_paise']/100
    ],$parcel);
}
final class ShiprocketClient {
    public function __construct(private array $settings,private ?\Closure $transport=null){}
    private function request(string $path,array $body,string $token=''): array {
        if($this->transport)return ($this->transport)($path,$body,$token);
        if(!function_exists('curl_init'))throw new ApiError(503,'Enable PHP cURL for Shiprocket.');
        $ch=curl_init('https://apiv2.shiprocket.in/v1/external/'.$path);
        $headers=['Content-Type: application/json','Accept: application/json'];if($token!=='')$headers[]='Authorization: Bearer '.$token;
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR),CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>30,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
        $raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
        if($raw===false||$status<200||$status>=300)throw new ApiError(502,'Shiprocket request failed (HTTP '.$status.'). Check Shiprocket before retrying.');
        try{$data=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}catch(\Throwable){throw new ApiError(502,'Shiprocket returned an unreadable response.');}
        if(!is_array($data))throw new ApiError(502,'Invalid Shiprocket response.');return $data;
    }
    public function authenticate(): string {
        if(empty($this->settings['email'])||empty($this->settings['password']))throw new ApiError(503,'Enter Shiprocket API credentials in the private configuration.');
        $data=$this->request('auth/login',['email'=>$this->settings['email'],'password'=>$this->settings['password']]);
        if(!is_string($data['token']??null)||$data['token']==='')throw new ApiError(502,'Shiprocket authentication failed.');return $data['token'];
    }
    public function create(array $payload,string $token): array {
        $data=$this->request('orders/create/adhoc',$payload,$token);
        if(empty($data['order_id'])||empty($data['shipment_id']))throw new ApiError(502,'Shiprocket did not confirm an order and shipment ID.');
        return ['order_id'=>(string)$data['order_id'],'shipment_id'=>(string)$data['shipment_id']];
    }
}
function shiprocketStatePath(string $id): string {
    if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError(422,'Invalid order ID.');
    $dir=dirname(__DIR__).'/storage/shiprocket';if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new ApiError(503,'Shiprocket storage is not writable.');return $dir.'/'.$id.'.json';
}
function shiprocketState(string $id): array {
    $path=shiprocketStatePath($id);if(!is_file($path))return ['status'=>'not_sent'];
    $data=json_decode((string)file_get_contents($path),true);return is_array($data)?$data:['status'=>'review_required'];
}
function sendShiprocket(string $id,?array $parcel=null): array {
    $c=shiprocketConfig();$store=config();
    if(!$c['enabled'])throw new ApiError(503,'Shiprocket is not enabled yet.');
    if(($store['environment']??'')!=='production'||($store['razorpay_mode']??'')!=='live')throw new ApiError(409,'Shipment creation is blocked for staging and test payments.');
    $path=shiprocketStatePath($id);$lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new ApiError(409,'This order is already being submitted.');
    try {
        $state=shiprocketState($id);if($state['status']==='sent')return $state;
        if(in_array($state['status'],['sending','review_required'],true))throw new ApiError(409,'Submission needs manual review in Shiprocket. It will not be resent automatically.');
        $o=getOrder($id);$parcel??=parcelPreset($o['items']);if(!$parcel)throw new ApiError(422,'Enter manual parcel details for this order.');
        $email=one('SELECT email FROM users WHERE id=?',[$o['user_id']])['email']??'';
        $payload=shiprocketPayload($o,$parcel,$email,$c['pickup_location']);
        $client=new ShiprocketClient($c);$token=$client->authenticate();
        $write=function(array $value)use($path){$json=json_encode($value,JSON_THROW_ON_ERROR);if(file_put_contents($path,$json,LOCK_EX)!==strlen($json))throw new ApiError(503,'Unable to save shipment status.');chmod($path,0600);};
        // Persist before external creation: ambiguous requests are never automatically replayed.
        $write(['status'=>'sending','at'=>now()]);
        try{$result=$client->create($payload,$token);$state=['status'=>'sent','at'=>now(),...$result];$write($state);return $state;}
        catch(\Throwable $e){$write(['status'=>'review_required','at'=>now()]);throw $e;}
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
