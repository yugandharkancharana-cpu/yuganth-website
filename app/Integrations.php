<?php
declare(strict_types=1);
namespace Yuganth;

interface PaymentGateway
{
    // Use order.id as the provider idempotency key. Return only browser-safe checkout fields.
    public function createCheckout(array $order): array;
    // Verify the raw body with the provider SDK/signature, then verify capture status,
    // merchant account and provider order mapping. Throw on any mismatch.
    // Return ['event_id'=> globally unique provider-prefixed ID, 'order_id'=> local ID,
    //         'amount_paise'=> integer captured amount, 'currency'=>'INR'].
    public function verifyCapturedWebhook(string $rawBody, array $headers): array;
}

final class DisabledGateway implements PaymentGateway
{
    public function createCheckout(array $order): array { throw new ApiError(503, 'Payment provider is not configured.'); }
    public function verifyCapturedWebhook(string $rawBody, array $headers): array { throw new ApiError(503, 'Payment webhook is not configured.'); }
}
final class ManualTestGateway implements PaymentGateway
{
    public function createCheckout(array $order): array { return ['mode' => 'manual_test', 'message' => 'Test order reserved. No payment collected.']; }
    public function verifyCapturedWebhook(string $rawBody, array $headers): array { throw new ApiError(503, 'Test mode does not accept payment webhooks.'); }
}
function gateway(): PaymentGateway
{
    $c = config();
    if ($c['payment_driver'] === 'manual_test' && $c['environment'] !== 'production') return new ManualTestGateway();
    if ($c['payment_driver'] === 'custom' && is_file($c['payment_adapter_file'])) {
        $adapter = require $c['payment_adapter_file'];
        if ($adapter instanceof PaymentGateway) return $adapter;
        throw new \RuntimeException('Payment adapter must implement PaymentGateway.');
    }
    return new DisabledGateway();
}

interface NotificationSender
{
    // Implement email/WhatsApp transport, consent checks, approved templates and provider idempotency.
    // Throw on retryable errors. Never return success before provider acceptance.
    public function deliver(string $messageId, string $kind, array $payload): void;
}
