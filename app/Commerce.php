<?php
declare(strict_types=1);
namespace Yuganth;

function catalogue(): array
{
    $products = rows('SELECT * FROM products WHERE active=1 ORDER BY id');
    foreach ($products as &$p) $p['variants'] = rows('SELECT id,weight_g,price_paise,stock,price_confirmed FROM variants WHERE product_id=? AND active=1 ORDER BY weight_g', [$p['id']]);
    return $products;
}
function validateAddress(mixed $a): array
{
    if (!is_array($a)) throw new ApiError(422, 'A delivery address is required.');
    $result = [];
    foreach (['name'=>120, 'phone'=>15, 'line1'=>200, 'city'=>100, 'state'=>100, 'pincode'=>6] as $key=>$max) $result[$key] = text($a[$key] ?? null, $max, $key);
    if (!preg_match('/^[6-9][0-9]{9}$/', $result['phone'])) throw new ApiError(422, 'Enter a ten-digit Indian mobile number.');
    if (!preg_match('/^[1-9][0-9]{5}$/', $result['pincode'])) throw new ApiError(422, 'Invalid delivery postcode.');
    $result['line2'] = isset($a['line2']) && $a['line2'] !== '' ? text($a['line2'], 200, 'address line 2') : '';
    return $result;
}
function normalizeLines(mixed $lines): array
{
    if (!is_array($lines) || !array_is_list($lines) || count($lines) < 1 || count($lines) > 50) throw new ApiError(422, 'Add between 1 and 50 cart lines.');
    $result = [];
    foreach ($lines as $line) {
        if (!is_array($line)) throw new ApiError(422, 'Invalid cart line.');
        $id = text($line['variant_id'] ?? null, 60, 'variant');
        $q = integer($line['quantity'] ?? null, 1, 99, 'quantity');
        $result[$id] = ($result[$id] ?? 0) + $q;
        if ($result[$id] > 99) throw new ApiError(422, 'Maximum 99 packs per variant.');
    }
    ksort($result); return $result;
}
function couponCode(mixed $code): string
{
    if ($code === null || $code === '') return '';
    $c = strtoupper(text($code, 40, 'coupon'));
    if (!preg_match('/^[A-Z0-9_-]+$/', $c)) throw new ApiError(422, 'Invalid coupon.'); return $c;
}
function calculate(array $normalized, string $code, string $pincode, bool $lock = false): array
{
    $c = config();
    if (!in_array($pincode, $c['serviceable_pincodes'], true)) throw new ApiError(422, 'Delivery is not available for this postcode.');
    $subtotal = 0; $lines = [];
    foreach ($normalized as $id => $q) {
        // Lock variants in deterministic order. Catalog edits use the same row locks.
        $v = one('SELECT v.*,p.name,p.active AS product_active,p.launch_status FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?' . ($lock ? lockSuffix() : ''), [$id]);
        if (!$v || !(int)$v['active'] || !(int)$v['product_active'] || $v['launch_status']!=='available' || !(int)$v['price_confirmed'] || (int)$v['price_paise']<=0 || (int)$v['stock'] < $q) throw new ApiError(409, 'A selected pack is unavailable, awaiting price confirmation or has insufficient stock.');
        $subtotal += (int)$v['price_paise'] * $q;
        $lines[] = ['variant_id'=>$id,'name'=>$v['name'],'weight_g'=>(int)$v['weight_g'],'quantity'=>$q,'unit_paise'=>(int)$v['price_paise']];
    }
    $discount = 0;
    if ($code !== '') {
        $coupon = one('SELECT * FROM coupons WHERE code=?' . ($lock ? lockSuffix() : ''), [$code]);
        if (!$coupon || !(int)$coupon['active'] || now() < (int)$coupon['starts_at'] || now() >= (int)$coupon['ends_at'] || $subtotal < (int)$coupon['minimum_paise'] || ((int)$coupon['usage_limit'] > 0 && (int)$coupon['uses'] >= (int)$coupon['usage_limit'])) throw new ApiError(422, 'This coupon is unavailable for your order.');
        $discount = intdiv($subtotal * (int)$coupon['percent'], 100);
        if ((int)$coupon['max_discount_paise'] > 0) $discount = min($discount, (int)$coupon['max_discount_paise']);
    }
    $shipping = $subtotal - $discount >= $c['free_shipping_above_paise'] ? 0 : $c['shipping_paise'];
    if ($subtotal-$discount+$shipping > 1000000000) throw new ApiError(422,'Order exceeds the supported total. Contact our team.');
    return ['currency'=>'INR','items'=>$lines,'subtotal_paise'=>$subtotal,'discount_paise'=>$discount,'shipping_paise'=>$shipping,'total_paise'=>$subtotal-$discount+$shipping];
}
function getOrder(string $id, ?string $userId = null): array
{
    $o = $userId === null ? one('SELECT * FROM orders WHERE id=?', [$id]) : one('SELECT * FROM orders WHERE id=? AND user_id=?', [$id, $userId]);
    if (!$o) throw new ApiError(404, 'Order not found.');
    unset($o['fingerprint'], $o['idempotency_key']);
    $o['address'] = json_decode($o['address'], true);
    $o['items'] = rows('SELECT variant_id,name,weight_g,quantity,unit_paise FROM order_items WHERE order_id=? ORDER BY variant_id', [$id]);
    return $o;
}
function createOrder(string $userId, array $input, string $key): array
{
    $c = config();
    if (!$c['checkout_enabled'] || !$c['catalog_verified'] || gateway() instanceof DisabledGateway) throw new ApiError(503, 'Checkout is not enabled yet. Please contact our team.');
    if ($c['environment'] === 'production' && !in_array($c['payment_driver'],['custom','razorpay'],true)) throw new ApiError(503, 'A live payment adapter is required.');
    $key = text($key, 100, 'idempotency key', 16);
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $key)) throw new ApiError(422, 'Invalid idempotency key.');
    $lines = normalizeLines($input['items'] ?? null); $address = validateAddress($input['address'] ?? null); $coupon = couponCode($input['coupon'] ?? '');
    $fingerprint = hash('sha256', json_encode([$lines, $address, $coupon], JSON_THROW_ON_ERROR));
    try { $result = transaction(function () use ($userId,$key,$fingerprint,$lines,$address,$coupon,$c) {
        $old = one('SELECT id,fingerprint FROM orders WHERE user_id=? AND idempotency_key=?', [$userId,$key]);
        if ($old) {
            if (!hash_equals($old['fingerprint'], $fingerprint)) throw new ApiError(409, 'This checkout key was already used with different details.');
            return getOrder($old['id'], $userId);
        }
        $quote = calculate($lines,$coupon,$address['pincode'],true); $id=uid();
        query('INSERT INTO orders (id,user_id,idempotency_key,fingerprint,status,currency,subtotal_paise,discount_paise,shipping_paise,total_paise,coupon_code,address,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [$id,$userId,$key,$fingerprint,'pending_payment','INR',$quote['subtotal_paise'],$quote['discount_paise'],$quote['shipping_paise'],$quote['total_paise'],$coupon?:null,json_encode($address, JSON_THROW_ON_ERROR),now(),now()+$c['reservation_minutes']*60]);
        foreach ($quote['items'] as $l) {
            query('UPDATE variants SET stock=stock-? WHERE id=? AND stock>=?', [$l['quantity'],$l['variant_id'],$l['quantity']]);
            query('INSERT INTO order_items (id,order_id,variant_id,name,weight_g,quantity,unit_paise) VALUES (?,?,?,?,?,?,?)', [uid(),$id,$l['variant_id'],$l['name'],$l['weight_g'],$l['quantity'],$l['unit_paise']]);
        }
        if ($coupon !== '') query('UPDATE coupons SET uses=uses+1 WHERE code=?', [$coupon]);
        return getOrder($id,$userId);
    }); } catch (\PDOException $e) {
        // A concurrent request may have inserted this key after our initial lookup.
        if (!in_array((string)$e->getCode(), ['23000','23505'], true)) throw $e;
        $old = one('SELECT id,fingerprint FROM orders WHERE user_id=? AND idempotency_key=?', [$userId,$key]);
        if (!$old) throw $e;
        if (!hash_equals($old['fingerprint'],$fingerprint)) throw new ApiError(409,'This checkout key was already used with different details.');
        return getOrder($old['id'],$userId);
    }
    return $result;
}
// Call ONLY with an event verified by a configured PaymentGateway. Never expose as a client-paid flag.
function confirmPayment(array $event): array
{
    $eventId = text($event['event_id'] ?? null, 150, 'payment event');
    $id = text($event['order_id'] ?? null, 32, 'order ID');
    $amount = integer($event['amount_paise'] ?? null, 1, 1000000000, 'captured amount');
    if (($event['currency'] ?? '') !== 'INR') throw new ApiError(409,'Payment currency mismatch.');
    return transaction(function () use ($eventId,$id,$amount) {
        $o = one('SELECT * FROM orders WHERE id=?'.lockSuffix(), [$id]);
        if (!$o || (int)$o['total_paise'] !== $amount) throw new ApiError(409,'Payment order or amount mismatch.');
        $old = one('SELECT * FROM payment_events WHERE event_id=?', [$eventId]);
        if ($old) {
            if ($old['order_id'] !== $id || (int)$old['amount_paise'] !== $amount) throw new ApiError(409,'Payment event was already used.');
            return getOrder($id);
        }
        if ($o['status'] !== 'pending_payment' || (int)$o['expires_at'] < now()) throw new ApiError(409,'Order is no longer payable. Reconcile the capture with the provider.');
        query('INSERT INTO payment_events (event_id,order_id,amount_paise,created_at) VALUES (?,?,?,?)', [$eventId,$id,$amount,now()]);
        query("UPDATE orders SET status='processing' WHERE id=?", [$id]);
        queue('order.paid', ['order_id'=>$id,'user_id'=>$o['user_id']]);
        return getOrder($id);
    });
}
function cancelOrder(string $id, string $actor, bool $expired = false): void
{
    transaction(function () use ($id,$actor,$expired) {
        $o = one('SELECT * FROM orders WHERE id=?'.lockSuffix(), [$id]);
        if (!$o) throw new ApiError(404,'Order not found.');
        if (in_array($o['status'], ['cancelled','expired'],true)) return;
        if ($o['status'] !== 'pending_payment' || ($expired && (int)$o['expires_at'] > now())) throw new ApiError(409,'Order cannot be cancelled.');
        foreach(rows('SELECT * FROM order_items WHERE order_id=? ORDER BY variant_id',[$id]) as $line) query('UPDATE variants SET stock=stock+? WHERE id=?',[(int)$line['quantity'],$line['variant_id']]);
        if ($o['coupon_code']) query('UPDATE coupons SET uses=uses-1 WHERE code=? AND uses>0',[$o['coupon_code']]);
        query('UPDATE orders SET status=? WHERE id=?',[$expired?'expired':'cancelled',$id]);
        audit($expired?'order.expired':'order.cancelled',$id,$actor);
    });
}
function fulfillOrder(string $id, string $status, string $tracking, string $actor): void
{
    if (!in_array($status,['shipped','delivered'],true)) throw new ApiError(422,'Invalid fulfilment status.');
    if ($status === 'shipped' && (strlen($tracking)>1000 || !filter_var($tracking,FILTER_VALIDATE_URL) || parse_url($tracking,PHP_URL_SCHEME)!=='https')) throw new ApiError(422,'A valid HTTPS tracking URL is required.');
    transaction(function () use ($id,$status,$tracking,$actor) {
        $o=one('SELECT * FROM orders WHERE id=?'.lockSuffix(),[$id]);
        if (!$o) throw new ApiError(404,'Order not found.');
        if (($status==='shipped' && $o['status']!=='processing') || ($status==='delivered' && $o['status']!=='shipped')) throw new ApiError(409,'Invalid order status transition.');
        query('UPDATE orders SET status=?,tracking_url=? WHERE id=?',[$status,$status==='shipped'?$tracking:$o['tracking_url'],$id]);
        audit('order.'.$status,$id,$actor);queue('order.'.$status,['order_id'=>$id,'user_id'=>$o['user_id']]);
    });
}
