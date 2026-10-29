<?php
// Copy to razorpay.local.php in the PRIVATE config directory. Never commit actual keys.
// These settings override local.php for staged Razorpay testing. Database settings stay in local.php.
return [
    'environment' => 'staging',
    'checkout_enabled' => false,
    'catalog_verified' => false,
    'payment_driver' => 'razorpay',
    'razorpay_mode' => 'test',
    'razorpay_key_id' => '',
    'razorpay_key_secret' => '',
    'razorpay_webhook_secret' => '',
    'razorpay_live_enabled' => false,
];
