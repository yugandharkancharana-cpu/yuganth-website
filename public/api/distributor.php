<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$private = $root . '/yuganth-app/app/bootstrap.php';
require is_file($private) ? $private : $root . '/app/bootstrap.php';

use Yuganth\{ApiError, RazorpayGateway};
use function Yuganth\{audit, config, confirmPayment, gateway, getOrder, integer, lockSuffix, now, one, query, rows, sessionStart, text, throttle, transaction, uid, user, validateAddress};

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function distributorReply(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}

function distributorProducts(): array
{
    $products = rows("SELECT id,name,active,launch_status FROM products ORDER BY name");
    $settings = array_column(rows("SELECT name,value FROM settings WHERE name LIKE 'dist_product:%'"), 'value', 'name');
    foreach ($products as &$product) {
        $default = in_array($product['id'], ['guntur-gold', 'araku-gold', 'spice-loom'], true);
        $setting = json_decode($settings['dist_product:' . $product['id']] ?? 'null', true);
        $product['enabled'] = $setting['enabled'] ?? $default;
        $product['gst_bps'] = $setting['gst_bps'] ?? 500;
    }
    return $products;
}

function distributorAmount(mixed $value): int
{
    if (!is_string($value) || !preg_match('/^([0-9]{1,7})(?:\.([0-9]{1,2}))?$/D', $value, $match)) {
        throw new ApiError(422, 'Enter the agreed amount in rupees with up to two decimal places.');
    }
    return integer((int)$match[1] * 100 + (int)str_pad($match[2] ?? '', 2, '0'), 100, 700000000, 'agreed amount');
}

function distributorGateway(): RazorpayGateway
{
    if (!config()['checkout_enabled'] || !config()['catalog_verified']) throw new ApiError(503, 'Payment is currently unavailable.');
    $provider = gateway();
    if (!$provider instanceof RazorpayGateway) throw new ApiError(503, 'Distributor payments require Razorpay.');
    return $provider;
}

try {
    sessionStart();
    $route = $_GET['route'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!is_string($route) || !in_array($method, ['GET', 'POST'], true)) throw new ApiError(404, 'Not found.');
    $input = [];
    if ($method === 'POST') {
        if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) throw new ApiError(415, 'Use application/json.');
        if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) throw new ApiError(419, 'Refresh your session and try again.');
        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if (strlen($raw) > 65536) throw new ApiError(413, 'Request too large.');
        try { $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); }
        catch (JsonException $error) { throw new ApiError(400, 'Invalid JSON.'); }
        if (!is_array($input)) throw new ApiError(400, 'Invalid request.');
    }

    if ($method === 'GET' && $route === '/catalog') {
        $products = array_values(array_filter(distributorProducts(), fn($p) => $p['enabled'] && $p['active'] && $p['launch_status'] === 'available'));
        distributorReply(['products' => $products, 'csrf' => $_SESSION['csrf']]);
    }

    if (str_starts_with($route, '/admin/')) {
        $admin = user(true);
        if ($method === 'GET' && $route === '/admin/products') distributorReply(['products' => distributorProducts(), 'csrf' => $_SESSION['csrf']]);
        if ($method === 'POST' && $route === '/admin/products') {
            $id = text($input['id'] ?? null, 47, 'product');
            if (!one('SELECT id FROM products WHERE id=?', [$id])) throw new ApiError(404, 'Product not found.');
            if (!is_bool($input['enabled'] ?? null)) throw new ApiError(422, 'Choose distributor availability.');
            $rate = integer($input['gst_bps'] ?? null, 0, 2800, 'GST rate');
            $key = 'dist_product:' . $id;
            $value = json_encode(['enabled' => $input['enabled'], 'gst_bps' => $rate], JSON_THROW_ON_ERROR);
            transaction(function () use ($id, $key, $value, $admin) {
                one('SELECT id FROM products WHERE id=?' . lockSuffix(), [$id]);
                if (one('SELECT name FROM settings WHERE name=?', [$key])) query('UPDATE settings SET value=? WHERE name=?', [$value, $key]);
                else query('INSERT INTO settings (name,value) VALUES (?,?)', [$key, $value]);
                audit('distributor.product', $id, $admin['id']);
            });
            distributorReply(['saved' => true]);
        }
        if ($method === 'GET' && $route === '/admin/orders') {
            $orders = rows("SELECT id,status,address,subtotal_paise,total_paise,created_at FROM orders WHERE idempotency_key LIKE 'dist:%' ORDER BY created_at DESC LIMIT 100");
            foreach ($orders as &$order) $order['address'] = json_decode($order['address'], true, 32, JSON_THROW_ON_ERROR);
            distributorReply(['orders' => $orders]);
        }
        if ($method === 'POST' && $route === '/admin/reconcile') {
            $id = text($input['id'] ?? null, 32, 'order reference', 32);
            $agreed = distributorAmount($input['agreed'] ?? null);
            transaction(function () use ($id, $agreed, $admin) {
                $order = one("SELECT status,subtotal_paise,address FROM orders WHERE id=? AND idempotency_key LIKE 'dist:%'" . lockSuffix(), [$id]);
                if (!$order || $order['status'] !== 'processing') throw new ApiError(409, 'Only paid distributor orders can be reviewed.');
                if ((int)$order['subtotal_paise'] !== $agreed) throw new ApiError(409, 'The amount paid does not match the phone quote. Resolve the difference before dispatch.');
                $address = json_decode($order['address'], true, 32, JSON_THROW_ON_ERROR);
                if (!empty($address['distributor']['reviewed_at'])) return;
                $address['distributor']['reviewed_at'] = now();
                query('UPDATE orders SET address=? WHERE id=?', [json_encode($address, JSON_THROW_ON_ERROR), $id]);
                audit('distributor.quote_verified', $id, $admin['id']);
            });
            distributorReply(['saved' => true]);
        }
        throw new ApiError(404, 'Not found.');
    }

    $owner = $_SESSION['distributor_owner'] ?? null;
    if ($method === 'POST' && $route === '/orders') {
        throttle('distributor-create', 15, 3600);
        distributorGateway();
        if (($input['accepted'] ?? null) !== true) throw new ApiError(422, 'Confirm the phone quote and purchase terms.');
        $key = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? '';
        if (!preg_match('/^[a-f0-9]{32}$/D', $key)) throw new ApiError(422, 'Refresh and try again.');
        $key = 'dist:' . $key;
        $fingerprint = hash('sha256', json_encode($input, JSON_THROW_ON_ERROR));
        if ($owner && ($existing = one('SELECT id,fingerprint FROM orders WHERE user_id=? AND idempotency_key=?', [$owner, $key]))) {
            if (!hash_equals($existing['fingerprint'], $fingerprint)) throw new ApiError(409, 'This order reference was already used.');
            distributorReply(['order' => getOrder($existing['id'], $owner)]);
        }
        $subtotal = distributorAmount($input['agreed'] ?? null);
        $address = validateAddress($input['address'] ?? null);
        $email = text($input['email'] ?? null, 200, 'email');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new ApiError(422, 'Enter a valid email address.');
        $gstin = strtoupper(trim((string)($input['gstin'] ?? '')));
        if ($gstin !== '' && !preg_match('/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/D', $gstin)) throw new ApiError(422, 'Enter a valid GSTIN or leave it blank.');
        $items = $input['items'] ?? null;
        if (!is_array($items) || !array_is_list($items) || count($items) < 1 || count($items) > 20) throw new ApiError(422, 'Add between 1 and 20 product lines.');
        $catalog = array_column(distributorProducts(), null, 'id');
        $rate = null;
        $lines = [];
        foreach ($items as $line) {
            if (!is_array($line)) throw new ApiError(422, 'Invalid product line.');
            $id = text($line['id'] ?? null, 47, 'product');
            $product = $catalog[$id] ?? null;
            if (!$product || !$product['enabled'] || !$product['active'] || $product['launch_status'] !== 'available') throw new ApiError(422, 'A product is no longer available for bulk ordering.');
            if ($rate !== null && $rate !== $product['gst_bps']) throw new ApiError(422, 'Enter separate agreed totals for products with different GST rates.');
            $rate = $product['gst_bps'];
            $pack = $line['pack'] ?? '';
            if (!in_array($pack, ['branded', 'loose'], true)) throw new ApiError(422, 'Choose branded or loose packing.');
            $lines[] = ['id' => $id, 'name' => $product['name'], 'pack' => $pack, 'grams' => integer($line['grams'] ?? null, 1, 100000, 'pack weight'), 'quantity' => integer($line['quantity'] ?? null, 1, 10000, 'quantity')];
        }
        $gst = intdiv($subtotal * $rate + 5000, 10000);
        $address['distributor'] = ['company' => text($input['company'] ?? null, 150, 'company name'), 'email' => $email, 'gstin' => $gstin, 'lines' => $lines, 'gst_bps' => $rate, 'gst_paise' => $gst, 'terms_accepted_at' => now(), 'terms_version' => '2026-11-03'];
        $id = uid();
        $owner ??= uid();
        transaction(function () use ($id, $owner, $key, $fingerprint, $address, $subtotal, $gst) {
            if (!one("SELECT id FROM users WHERE id=? AND role='guest'", [$owner])) {
                query('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)', [$owner, 'Distributor checkout', 'distributor-'.$owner.'@guest.yuganth.invalid', password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT), 'guest', now()]);
            }
            query('INSERT INTO orders (id,user_id,idempotency_key,fingerprint,status,currency,subtotal_paise,discount_paise,shipping_paise,total_paise,address,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [$id, $owner, $key, $fingerprint, 'pending_payment', 'INR', $subtotal, 0, 0, $subtotal + $gst, json_encode($address, JSON_THROW_ON_ERROR), now(), now() + 1800]);
        });
        $_SESSION['distributor_owner'] = $owner;
        distributorReply(['order' => getOrder($id, $owner)], 201);
    }

    if (!$owner || !preg_match('~^/orders/([a-f0-9]{32})(/payment(?:/verify)?)?$~D', $route, $match)) throw new ApiError(404, 'Distributor order not found in this session.');
    $order = getOrder($match[1], $owner);
    $action = $match[2] ?? '';
    if ($method === 'GET' && $action === '') distributorReply(['order' => $order]);
    if ($method === 'POST' && $action === '/payment') {
        throttle('distributor-payment', 30, 3600);
        distributorReply(['checkout' => distributorGateway()->createCheckout($order)]);
    }
    if ($method === 'POST' && $action === '/payment/verify') {
        throttle('distributor-verify', 40, 3600);
        $provider = gateway();
        if (!$provider instanceof RazorpayGateway) throw new ApiError(503, 'Payment verification is unavailable.');
        distributorReply(['order' => confirmPayment($provider->verifyCheckout($order, $input))]);
    }
    throw new ApiError(404, 'Not found.');
} catch (ApiError $error) {
    distributorReply(['error' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    error_log('Yuganth distributor API: ' . get_class($error));
    distributorReply(['error' => 'Distributor service is temporarily unavailable. Contact Yuganth for help.'], 503);
}
