<?php
// Copy to config/local.php OUTSIDE public_html. Never commit local.php.
return [
    'environment' => 'development', // production requires HTTPS and a configured gateway
    'base_url' => 'http://127.0.0.1:8080',
    'dsn' => 'sqlite:' . dirname(__DIR__) . '/storage/yuganth.sqlite',
    'db_user' => '',
    'db_password' => '',
    // Hostinger: mysql:host=localhost;dbname=YOUR_DATABASE;charset=utf8mb4
    'checkout_enabled' => false,
    'catalog_verified' => false,
    'session_idle_seconds' => 1800,
    'reservation_minutes' => 30,
    'shipping_paise' => 6000,
    'free_shipping_above_paise' => 99900,
    'serviceable_pincodes' => [], // explicitly list supported Indian postcodes
    'razorpay_mode' => 'test', // test or live; live requires production + explicit approval below
    'razorpay_key_id' => '',
    'razorpay_key_secret' => '',
    'razorpay_webhook_secret' => '', // separate secret chosen when adding the webhook
    'razorpay_live_enabled' => false,
    'payment_driver' => 'disabled', // manual_test allowed ONLY outside production
    'payment_adapter_file' => '', // absolute path to a PHP file returning PaymentGateway
    'whatsapp_number' => '', // optional click-to-chat number, digits only
    'support_email' => 'Support@yuganth.com',
];
