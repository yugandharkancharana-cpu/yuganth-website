<?php
declare(strict_types=1);
require dirname(__DIR__,2) . '/app/bootstrap.php';
use function Yuganth\{config,db,query,one,rows,uid,now,text,integer,sessionStart,user,throttle,transaction,queue,audit,catalogue,normalizeLines,couponCode,calculate,validateAddress,createOrder,getOrder,cancelOrder,fulfillOrder,gateway,confirmPayment};
use Yuganth\ApiError;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
function reply(mixed $data, int $status = 200): never { http_response_code($status); echo json_encode($data,JSON_THROW_ON_ERROR); exit; }
try {
    $route = $_GET['route'] ?? '/session';
    if (!is_string($route)) throw new ApiError(404,'Route not found.');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $raw = file_get_contents('php://input',false,null,0,65537);
    if (strlen($raw)>65536) throw new ApiError(413,'Request too large.');
    if ($route === '/webhooks/payment' && $method==='POST') {
        // No session/CSRF for provider callbacks: authentication is the gateway's verified signature.
        if (config()['environment']==='production' && ($_SERVER['HTTPS']??'')!=='on') throw new ApiError(400,'HTTPS required.');
        $verified = gateway()->verifyCapturedWebhook($raw, function_exists('getallheaders')?getallheaders():[]);
        $order = confirmPayment($verified);
        reply(['received'=>true,'order_id'=>$order['id']]);
    }
    sessionStart();
    if (!in_array($method,['GET','POST'],true)) throw new ApiError(405,'Method not allowed.');
    $input = [];
    if ($method === 'POST') {
        if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')) throw new ApiError(415,'Use application/json.');
        if (!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) throw new ApiError(419,'Session expired. Refresh and try again.');
        try { $input=json_decode($raw,true,32,JSON_THROW_ON_ERROR); } catch (\JsonException $e) { throw new ApiError(400,'Invalid JSON.'); }
        if (!is_array($input)) throw new ApiError(400,'JSON object required.');
    }
    if ($method==='GET' && $route==='/session') {
        try { $u=user(); } catch(ApiError $e) { $u=null; }
        reply(['user'=>$u,'csrf'=>$_SESSION['csrf'],'checkout_enabled'=>(bool)(config()['checkout_enabled']&&config()['catalog_verified']&&!(gateway() instanceof \Yuganth\DisabledGateway))]);
    }
    if ($method==='GET' && $route==='/catalog') reply(['products'=>catalogue()]);
    if ($method==='GET' && $route==='/settings') reply(['banner'=>one('SELECT value FROM settings WHERE name=?',['banner'])['value']??'FROM OUR ROOTS. TO YOUR KITCHEN.','whatsapp_number'=>config()['whatsapp_number']]);
    if ($method==='POST' && in_array($route,['/auth/register','/auth/login'],true)) {
        throttle('auth',20);
        $email=strtolower(text($input['email']??null,254,'email'));
        if (!filter_var($email,FILTER_VALIDATE_EMAIL)) throw new ApiError(422,'Invalid email.');
        $password=$input['password']??null;
        if (!is_string($password)||strlen($password)<12||strlen($password)>72) throw new ApiError(422,'Use a password between 12 and 72 bytes.');
        if ($route==='/auth/register') {
            $name=text($input['name']??null,120,'name');$id=uid();
            try { query('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)',[$id,$name,$email,password_hash($password,PASSWORD_DEFAULT),now()]); }
            catch(\PDOException $e) { if (in_array((string)$e->getCode(),['23000','23505'],true)) throw new ApiError(409,'Unable to register this email. Try signing in or resetting your password.'); throw $e; }
        } else {
            $record=one('SELECT * FROM users WHERE email=?',[$email]);
            $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
            $valid=password_verify($password,$record['password_hash']??$dummy);
            if (!$record || !$valid) throw new ApiError(401,'Email or password is incorrect.');
            $id=$record['id'];
        }
        session_regenerate_id(true);$_SESSION=['user_id'=>$id,'auth_version'=>(int)one('SELECT auth_version FROM users WHERE id=?',[$id])['auth_version'],'csrf'=>uid(),'last_seen'=>now()];
        reply(['user'=>user(),'csrf'=>$_SESSION['csrf']]);
    }
    if ($method==='POST' && $route==='/auth/logout') { $_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=uid();reply(['csrf'=>$_SESSION['csrf']]); }
    if ($method==='POST' && $route==='/auth/forgot') {
        throttle('reset',5);
        $email=strtolower(text($input['email']??null,254,'email'));$record=one('SELECT id FROM users WHERE email=?',[$email]);
        if ($record) transaction(function() use($record,$email) {
            $token=bin2hex(random_bytes(32));query('DELETE FROM password_resets WHERE user_id=?',[$record['id']]);
            query('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)',[hash('sha256',$token),$record['id'],now()+1800]);
            queue('auth.reset',['email'=>$email,'url'=>rtrim(config()['base_url'],'/').'/account.html#reset='.$token]);
        });
        reply(['message'=>'If the email is registered, reset instructions have been queued for delivery.']);
    }
    if ($method==='POST' && $route==='/auth/reset') {
        throttle('reset-confirm',10);$token=text($input['token']??null,64,'reset token',64);$password=$input['password']??null;
        if (!is_string($password)||strlen($password)<12||strlen($password)>72) throw new ApiError(422,'Use a password between 12 and 72 bytes.');
        transaction(function() use($token,$password) {
            $r=one('SELECT * FROM password_resets WHERE token_hash=?'.\Yuganth\lockSuffix(),[hash('sha256',$token)]);
            if (!$r || (int)$r['expires_at']<now()) throw new ApiError(422,'Reset link is invalid or expired.');
            query('UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$r['user_id']]);
            query('DELETE FROM password_resets WHERE user_id=?',[$r['user_id']]);
        });reply(['message'=>'Password changed. Please sign in.']);
    }
    if ($route==='/addresses') {
        $u=user();
        if($method==='GET')reply(['addresses'=>array_map(fn($r)=>['id'=>$r['id'],'address'=>json_decode($r['payload'],true)],rows('SELECT * FROM addresses WHERE user_id=?',[$u['id']]))]);
        if (($input['action']??'')==='delete') { query('DELETE FROM addresses WHERE id=? AND user_id=?',[text($input['id']??null,32,'address ID'),$u['id']]);reply(['deleted'=>true]); }
        if((int)one('SELECT COUNT(*) AS n FROM addresses WHERE user_id=?',[$u['id']])['n']>=10)throw new ApiError(422,'Maximum ten saved addresses.');
        $address=validateAddress($input['address']??null);$id=uid();query('INSERT INTO addresses (id,user_id,payload) VALUES (?,?,?)',[$id,$u['id'],json_encode($address,JSON_THROW_ON_ERROR)]);reply(['id'=>$id,'address'=>$address],201);
    }
    if ($method==='POST' && $route==='/cart/quote') {
        throttle('quote',120,60);reply(calculate(normalizeLines($input['items']??null),couponCode($input['coupon']??''),text($input['pincode']??null,6,'postcode',6)));
    }
    if ($route==='/orders') {
        $u=user();
        if ($method==='GET') reply(['orders'=>rows('SELECT id,status,currency,total_paise,created_at,tracking_url FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[$u['id']])]);
        throttle('orders',20,3600);$o=createOrder($u['id'],$input,$_SERVER['HTTP_IDEMPOTENCY_KEY']??'');reply(['order'=>$o],201);
    }
    if (preg_match('~^/orders/([a-f0-9]{32})(/payment|/cancel)?$~',$route,$m)) {
        $u=user();$o=getOrder($m[1],$u['id']);$action=$m[2]??'';
        if($method==='GET'&&$action==='')reply(['order'=>$o]);
        if($method==='POST'&&$action==='/cancel'){cancelOrder($o['id'],$u['id']);reply(['order'=>getOrder($o['id'],$u['id'])]);}
        if($method==='POST'&&$action==='/payment'){
            if($o['status']!=='pending_payment'||(int)$o['expires_at']<=now())throw new ApiError(409,'Order is no longer payable.');
            reply(['checkout'=>gateway()->createCheckout($o)]);
        }
    }
    if (str_starts_with($route,'/admin/')) {
        $u=user(true);
        if($method==='GET'&&$route==='/admin/orders')reply(['orders'=>rows('SELECT id,status,user_id,total_paise,created_at,tracking_url FROM orders ORDER BY created_at DESC LIMIT 100')]);
        if($method==='GET'&&$route==='/admin/coupons')reply(['coupons'=>rows('SELECT * FROM coupons ORDER BY code')]);
        if($method==='GET'&&$route==='/admin/products')reply(['products'=>rows('SELECT * FROM products ORDER BY id')]);
        if($method==='POST'&&$route==='/admin/product'){
            $id=text($input['id']??null,40,'product');$name=text($input['name']??null,120,'name');$description=text($input['description']??null,2000,'description');$origin=text($input['origin']??'',120,'origin',0);
            $category=$input['category']??'';$status=$input['launch_status']??'';$active=integer($input['active']??1,0,1,'active');
            if(!in_array($category,['spices','seeds','nuts','flours'],true)||!in_array($status,['available','coming_soon'],true))throw new ApiError(422,'Invalid category or launch status.');
            if($id==='pure-gold'&&$active)throw new ApiError(422,'Pure Gold is retired from this catalogue. Its records are retained for order history.');
            transaction(function()use($id,$name,$description,$origin,$category,$status,$active,$u){if(!one('SELECT id FROM products WHERE id=?'.\Yuganth\lockSuffix(),[$id]))throw new ApiError(404,'Product not found.');query('UPDATE products SET name=?,description=?,origin=?,category=?,launch_status=?,active=? WHERE id=?',[$name,$description,$origin,$category,$status,$active,$id]);audit('product.updated',$id,$u['id']);});reply(['saved'=>true]);
        }
        if($method==='GET'&&$route==='/admin/variants')reply(['variants'=>rows('SELECT v.*,p.name FROM variants v JOIN products p ON p.id=v.product_id ORDER BY v.id')]);
        if($method==='POST'&&$route==='/admin/variant'){
            $id=text($input['id']??null,60,'variant');$price=integer($input['price_paise']??null,0,1000000,'price');$stock=integer($input['stock']??null,0,1000000,'stock');$active=integer($input['active']??1,0,1,'active');$expected=integer($input['expected_stock']??null,0,1000000,'previous stock');$confirmed=integer($input['price_confirmed']??0,0,1,'price confirmation');
            if($confirmed&&$price<=0)throw new ApiError(422,'A confirmed price must be greater than zero.');
            transaction(function()use($id,$price,$stock,$active,$expected,$confirmed,$u){$old=one('SELECT id,stock FROM variants WHERE id=?'.\Yuganth\lockSuffix(),[$id]);if(!$old)throw new ApiError(404,'Variant not found.');if((int)$old['stock']!==$expected)throw new ApiError(409,'Stock changed since this page loaded. Refresh before saving.');query('UPDATE variants SET price_paise=?,stock=?,active=?,price_confirmed=? WHERE id=?',[$price,$stock,$active,$confirmed,$id]);audit('variant.updated',$id,$u['id']);});reply(['saved'=>true]);
        }
        if($method==='POST'&&$route==='/admin/coupon'){
            $code=couponCode($input['code']??null);if($code==='')throw new ApiError(422,'Coupon required.');
            $values=[integer($input['percent']??null,1,100,'discount'),integer($input['minimum_paise']??0,0,100000000,'minimum'),integer($input['max_discount_paise']??0,0,100000000,'discount cap'),integer($input['usage_limit']??0,0,1000000,'usage limit'),integer($input['starts_at']??null,0,4102444800,'start'),integer($input['ends_at']??null,0,4102444800,'end'),integer($input['active']??0,0,1,'active')];
            if($values[5]<=$values[4])throw new ApiError(422,'End must be after start.');
            transaction(function()use($code,$values,$u){$old=one('SELECT code FROM coupons WHERE code=?'.\Yuganth\lockSuffix(),[$code]);if($old)query('UPDATE coupons SET percent=?,minimum_paise=?,max_discount_paise=?,usage_limit=?,starts_at=?,ends_at=?,active=? WHERE code=?',[...$values,$code]);else query('INSERT INTO coupons (percent,minimum_paise,max_discount_paise,usage_limit,starts_at,ends_at,active,code) VALUES (?,?,?,?,?,?,?,?)',[...$values,$code]);audit('coupon.saved',$code,$u['id']);});reply(['saved'=>true]);
        }
        if($method==='POST'&&$route==='/admin/banner'){
            $value=text($input['value']??null,300,'banner');transaction(function()use($value,$u){query('DELETE FROM settings WHERE name=?',['banner']);query('INSERT INTO settings (name,value) VALUES (?,?)',['banner',$value]);audit('banner.updated','banner',$u['id']);});reply(['saved'=>true]);
        }
        if($method==='POST'&&$route==='/admin/order'){
            $id=text($input['id']??null,32,'order ID');$status=$input['status']??'';
            if($status==='cancelled')cancelOrder($id,$u['id']);else fulfillOrder($id,(string)$status,(string)($input['tracking_url']??''),$u['id']);reply(['order'=>getOrder($id)]);
        }
    }
    throw new ApiError(404,'Route not found.');
} catch(ApiError $e){reply(['error'=>$e->getMessage()],$e->status);}
catch(\Throwable $e){error_log('Yuganth API failure: '.get_class($e).' '.$e->getMessage());reply(['error'=>'The service is temporarily unavailable. Please try again.'],500);}
