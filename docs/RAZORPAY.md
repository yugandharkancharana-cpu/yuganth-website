# Razorpay setup for Yuganth

## Status
Standard Checkout integration implemented; default checkout remains disabled. Tests use a synthetic provider transport and mocked browser SDK, not an actual Razorpay account. An end-to-end staging test with your private test credentials is still required. Shiprocket and WhatsApp automation are separate integrations and are not added by this update. Delivery still uses the explicitly configured serviceable postcodes and fixed/free shipping rules.

## Private setup on the current Hostinger staging layout
Your public site is `/home/u322658527/domains/yuganth.com/public_html/staging`, and your private application is `/home/u322658527/domains/yuganth.com/yuganth-app`.

1. Back up the current application files and database. Download `Yuganth-Razorpay-Staging-Update.zip` and upload it beside `public_html` and `yuganth-app`, not inside public_html. The archive contains only source code and empty configuration examples; never add real credentials to an archive.
2. Extract it into a new folder named `razorpay-update`. Inside are `backend` and `frontend`. Copy the backend files into `yuganth-app` with the same paths, and frontend files into `public_html/staging`. Replace only matching files. Keep existing local.php, storage, media, .htaccess, .htpasswd and all other files. The update's public API file retains the staging-specific bootstrap path already fixed.
3. Enable PHP cURL and PDO MySQL in Hostinger, and use a supported PHP 8.3+ runtime. Do not change the main WordPress website's PHP version without checking compatibility. Check CLI PHP separately using `php -v` and `php -m`.
4. In SSH: `cd /home/u322658527/domains/yuganth.com/yuganth-app` then `php bin/console.php install`. This adds the Razorpay order mapping table; it does not replace existing records. Back up first even though migrations are additive.
5. Copy `config/razorpay.example.php` to `config/razorpay.local.php`, both outside public_html. Edit that private file in Hostinger, entering your Test Key ID, Test Key Secret and a separate randomly chosen webhook secret of at least 16 characters. Keep checkout_enabled and catalog_verified false at this stage. Never send screenshots showing secrets or put them in GitHub. This private file overrides the matching settings in local.php; database settings remain in local.php.
6. In Razorpay Test Mode, add a webhook to `https://staging.yuganth.com/api/index.php?route=/webhooks/payment`, using the same separate webhook secret. Subscribe to `payment.captured` and `order.paid`. Keep existing WordPress webhooks untouched. The endpoint must be reachable without a browser password prompt; if staging directory protection is enabled, use a narrowly scoped webhook exception rather than removing protection from the entire site. Browser verification still works without webhook delivery, but launch requires tested webhook recovery.
7. Verify payment capture settings in Razorpay Test Mode are automatic capture. Authorized-only payments do not fulfill orders. No automatic capture API call is performed by this code.
8. Confirm actual product prices and stock in admin, check the private server configuration's serviceable_pincodes and shipping charges, and use an explicit test postcode. Only when ready to test, set checkout_enabled=true and catalog_verified=true in the private razorpay.local.php. Environment must remain staging, mode test, live_enabled=false. Refresh the account/cart/checkout pages. Test keys collect no real money, but create real local test reservations/orders; use a dedicated test customer and small test stock.
9. Test successful, failed, dismissed and retry payments; confirm successful orders appear as processing, amounts match, duplicate callback/webhook events produce one notification, and unpaid reservations expire via `php bin/console.php expire`. Do not dispatch test orders through Shiprocket. Expiry runs through a scheduled worker; for production configure a single cron worker and monitor it.
10. Turn checkout_enabled=false after testing until shipping, policies, notifications and live readiness are complete.

## Live readiness (not enabled by this package)
Resolve Razorpay KYC/reKYC and confirm the merchant account can accept live payments. Confirm approved website, HTTPS, policies, final shipping and prices. Create an independent live webhook/secret and use live keys. Set environment=production, razorpay_mode=live and razorpay_live_enabled=true only for the actual production rollout. Both checkout_enabled and catalog_verified also need true. Test keys are refused in production, and live keys are refused outside production. Keep configuration files outside public_html. Do not reuse staging orders after switching keys. Shiprocket, notification delivery and refund administration remain separate launch work.

## Failure and reconciliation
A timed-out provider order creation is saved as uncertain and is not automatically retried; this prevents duplicate provider orders. Investigate in Razorpay by local order ID (receipt), using the same merchant/mode, before attaching a verified provider order mapping or creating a replacement reservation. Do not delete the mapping to force a retry. A capture arriving after local expiry/cancellation returns conflict for manual reconciliation; check merchant dashboard/API and refund or resolve stock explicitly. Refunds must be handled in Razorpay; this update does not provide refund controls or automatic reconciliation. Monitor failed webhook deliveries and server logs. Never mark an order paid by SQL or browser success alone.

## API
POST `/orders/{local-id}/payment`: signed-in owner + CSRF, checkout must be enabled. Returns browser-safe Standard Checkout options.
POST `/orders/{local-id}/payment/verify`: signed-in owner + CSRF; razorpay_payment_id, razorpay_order_id and razorpay_signature. Uses the stored provider order ID for HMAC, fetches payment/order using merchant API credentials, checks amount/currency/receipt/notes and captured status, then runs the existing idempotent confirmation transaction.
POST `/webhooks/payment`: raw-body HMAC with separate webhook secret, accepts captured/paid events only, authenticates provider entities via API. Signature-verified unrelated events are acknowledged and ignored. Callback and webhook use the same provider payment ID for deduplication.

## Verification
143 checks passed: 29 commerce, 10 migration, 65 HTTP, 26 Razorpay server and 13 Razorpay browser checks. Actual test-account checkout and Hostinger MySQL/webhook delivery remain to be verified after private configuration.

Official references:
https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
https://razorpay.com/docs/api/orders/create/
https://razorpay.com/docs/webhooks/validate-test/
