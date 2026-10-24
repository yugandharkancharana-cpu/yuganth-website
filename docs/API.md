# API reference

Base: `api/index.php?route=PATH`. All responses are JSON. Same-origin session cookies; no cross-origin CORS access. Read `/session` for a CSRF token and send `X-CSRF-Token` on every POST except the payment provider webhook. POST bodies use `application/json`, maximum 64 KiB. Errors use `{ "error": "message" }` with 4xx/5xx status.

| Route | Method | Purpose / body |
|---|---|---|
| `/session` | GET | User, CSRF token, checkout flag |
| `/catalog` | GET | Active products, variant IDs, price_paise, available stock |
| `/settings` | GET | Public banner and optional WhatsApp number |
| `/auth/register` | POST | name, email, password (12–72 bytes); creates customer only |
| `/auth/login` | POST | email, password; rotates session ID and CSRF |
| `/auth/logout` | POST | Empty object; rotates CSRF |
| `/auth/forgot` | POST | email; queues email transport message, uniform response |
| `/auth/reset` | POST | token, password; one use, 30-minute expiry, invalidates other sessions |
| `/addresses` | GET / POST | List own addresses / `{address}` / `{action:"delete",id}` |
| `/cart/quote` | POST | items, coupon, pincode; computes server totals, checks delivery and stock |
| `/orders` | GET / POST | Own latest 100 orders / items, coupon, address + `Idempotency-Key` header (16–100 safe characters) |
| `/orders/ID` | GET | Own order detail; 404 for other customers |
| `/orders/ID/cancel` | POST | Cancel own unpaid reservation; restore stock exactly once |
| `/orders/ID/payment` | POST | Create/reuse configured provider checkout |
| `/webhooks/payment` | POST | Raw provider request; requires configured adapter signature verification |
| `/admin/products` | GET | All product records for admin, including retired historical records |
| `/admin/product` | POST | id, name, description, origin, category (spices/seeds/nuts/flours), launch_status (available/coming_soon), active (0/1) |
| `/admin/variants` | GET | Administrator pack list |
| `/admin/variant` | POST | id, price_paise, stock, active (0/1), price_confirmed (0/1), expected_stock; prevents stale stock edits |
| `/admin/coupons` | GET | Coupon rules and reserved/used count |
| `/admin/coupon` | POST | code, percent, minimum_paise, max_discount_paise, usage_limit, starts_at, ends_at, active |
| `/admin/banner` | POST | value, up to 300 bytes |
| `/admin/orders` | GET | Latest 100 orders |
| `/admin/order` | POST | id, status (cancelled/shipped/delivered), tracking_url (HTTPS for shipped) |

`items`: `[{"variant_id":"guntur-gold-500","quantity":2}]`. Duplicate variant entries are aggregated; max 99 per variant, 50 input lines. Client prices and totals are ignored. Reusing an idempotency key with a different validated cart/address/coupon fails with 409.

`address`: `{name,phone,line1,line2,city,state,pincode}`. All are strings; line2 is optional. Phone is a ten-digit Indian mobile number; postcode is six digits and must be configured as serviceable for checkout.

Timestamps are Unix seconds in UTC. All money fields ending in `_paise` are integers. Database drivers may serialize numeric columns as strings, so clients should convert explicitly. The frontend shows INR.

Order lifecycle: `pending_payment → processing → shipped → delivered`. Only a verified provider capture can enter `processing`. Unpaid orders may become `cancelled` or `expired`. Cancelling a paid order or refunding it requires the future provider refund flow; the generic admin does not silently refund money.

Public catalogue products include launch_status and origin; variants include price_confirmed. The server rejects coming-soon products, inactive products/packs, zero or unconfirmed prices and insufficient stock. Fresh catalogue prices are zero/unconfirmed; admin must set real prices.


## Animated storefront additions
- GET `/reviews`: up to 200 approved reviews for visible products; no account email or private user ID.
- POST `/reviews`: authenticated, CSRF-protected JSON `{product,rating,name,title,text}`. Rating 1–5, text 15–1500 bytes. One review per user/product; edits return to pending. Purchase verification is derived on the server.
- GET `/reviews/mine`: own submissions and moderation status.
- GET `/admin/reviews`; POST `/admin/review` `{id,status}` where status is pending/approved/rejected.
- POST `/admin/product`: creates or edits stable lowercase slug ID, name, description, origin, category, launch_status, active, image, product_type, theme_color, text_color. New IDs create a default unconfirmed 500 g variant. Images must exist under assets/ or uploaded media/.
- POST `/admin/image`: admin-only multipart `image` and X-CSRF-Token header. Returns `{image:"media/random-id.webp"}`. Assign it to a product after upload.
- POST `/admin/banner`: `{value,speed,enabled}`. Speed 12–90 seconds, enabled 0/1; GET `/settings` returns banner_speed and banner_enabled.
