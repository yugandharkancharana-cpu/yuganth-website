# Integration contracts

## Payment gateway — intentionally disabled until configured

No live payment SDK or merchant credentials are included. The frontend never accepts a client-paid flag.

1. Install the selected provider's official PHP SDK using Composer outside the public directory. Add its autoloader in your adapter. Review and lock dependencies before release.
2. Implement `Yuganth\PaymentGateway` from `app/Integrations.php` in a private PHP file returning an adapter instance. Set `payment_driver` to `custom` and `payment_adapter_file` to its absolute path in `config/local.php`.
3. `createCheckout($order)` must create/reuse the provider order using the LOCAL order ID as its idempotency key. Persist the local-to-provider mapping in an added database table. Never trust an order ID supplied inside an unsigned webhook body. Use `total_paise` and `currency` from the local order. Return only publishable browser fields; never API secrets.
4. Add the provider browser SDK to `public/checkout.html` and implement `window.YuganthPayment.open(checkout, {orderId})`. Browser success is informational; query the backend order status for confirmation.
5. Point provider capture notifications to `https://YOUR_DOMAIN/api/index.php?route=/webhooks/payment`. `verifyCapturedWebhook` must verify the signature against the exact raw body, signature freshness/replay rules where supported, merchant account, capture status and the persisted provider-order mapping. Fetch the capture from the provider API when required. Return `event_id`, local `order_id`, integer `amount_paise` and `currency`. Prefix IDs with the provider name.
6. `confirmPayment` locks the local order and validates amount/currency/state. Duplicate verified event IDs are idempotent. Payment processing queues an `order.paid` outbox message. A second capture event against an already paid order is rejected for manual reconciliation.
7. Test success, cancellation, failure, retries, webhook duplicates, wrong signatures, wrong amounts, wrong merchant, late capture and refund paths in the provider sandbox. Implement provider event reconciliation and refunds before production.

Reservations expire after the configured period. Run `bin/console.php expire` every minute. A capture received after expiry is rejected and needs provider reconciliation/refund; it must not automatically resurrect released stock. Developers should synchronize provider payment expiry with local reservations and add a scheduled reconciliation process before launch. Payment webhooks can race with cancellation, and the order lock ensures only one local transition wins; money captured on a cancelled order still needs provider reconciliation.

## Email and WhatsApp Business

Messages are queued in the private database `outbox` table, not sent by default. This includes password-reset emails. Customers cannot complete password recovery until an email transport is connected.

Implement `NotificationSender::deliver($messageId,$kind,$payload)`. Return only after the provider accepts the message. Support:

- `auth.reset`: send the private reset URL by email only, never to logs or WhatsApp.
- `order.paid`, `order.shipped`, `order.delivered`: load the corresponding order/user and send the approved transactional notification.

Set `YUGANTH_NOTIFICATION_ADAPTER` to the private adapter file. Run `php bin/console.php outbox` from cron under a single-worker lock (`flock` where available). The worker retries up to ten times; monitor failed rows and provide an operator retry procedure. Providers must deduplicate using the outbox message ID because delivery acknowledgement and DB updates can fail independently.

For Meta WhatsApp Business or another provider, add approved templates, the user's consent record and timestamp, webhook verification, delivery receipts and opt-out handling in your integration. These are not implemented by the generic outbox. Keep provider secrets outside `public_html`.

Optional `whatsapp_number` currently enables only a click-to-chat link. It is not the WhatsApp Business API integration and does not send messages automatically.

## Shipping, taxes and refunds

Delivery uses a configured list of Indian postcodes, a flat shipping amount and a free-shipping threshold. Prices are treated as tax-inclusive; this code does not calculate jurisdiction-specific tax breakdowns, generate compliant invoices, connect a courier API or issue refunds. Confirm business tax rules and implement those provider/business requirements before release. Order tracking is an administrator-entered HTTPS URL.

## Products, coupons and permissions

Admin UI: `admin.html` after signing in with an admin account created by the CLI. Customers cannot choose their role. An administrator can edit existing product names, descriptions, origins, categories, launch status and visibility, as well as pack prices/stock/price confirmation, banner text, percentage coupons and fulfilment. Brand-new product creation, media uploads, tax configuration and customer-support tooling remain future admin extensions.

Prices are integer paise. Coupons support percent, minimum subtotal, maximum discount, dates, global usage limit and enabled state. Reservations consume coupon usage; cancellation/expiry releases it. Paid usage remains consumed. Per-customer/first-order restrictions and product exclusions are NOT implemented. Do not advertise FIRSTORDER eligibility until developers implement and test that rule. Seed data deliberately creates no promotional coupon.

Customer sessions use HttpOnly cookies, SameSite=Lax, CSRF tokens, idle expiry and password hashes. Production cookies require HTTPS. API rate limits use REMOTE_ADDR, not untrusted proxy headers; configure a trusted proxy layer deliberately if needed. Add email verification, admin MFA, monitoring and abuse controls before a public launch. No existing WordPress password hashes or customer records are migrated automatically.
