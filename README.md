# Yuganth animated store + administration

The October 24 animated forest-green / gold design is integrated with the PHP store backend. This package replaces the previous storefront source; existing database records and private configuration must be preserved during upgrades.

- Animated desktop and mobile storefront, six new pack images, product filters, real variant-ID shopping bag and checkout handoff.
- `public/admin.html`: add products, upload images, edit names/descriptions/origins/categories/card colours/visibility/launch status, confirm prices and update stock.
- Offers: percentage coupon rules with start/end dates, minimum subtotal, cap and usage limits.
- Scrolling announcement: text, visibility and speed (12–90 seconds) controlled in admin.
- Reviews page: signed-in submissions, private drafts, pending/approved/rejected moderation; verified-purchase badge derived from paid orders.
- Customer accounts, addresses, order history and fulfillment retained.

## Run locally

Requires PHP 8.3+ with PDO SQLite (or MySQL), GD with WebP support for image uploads, and Python only for tests. No Node build is required.

1. Copy `config/config.example.php` to `config/local.php` and set a database connection and base URL.
2. Run `php bin/console.php install` from the package root. This adds missing tables/columns and seeds the catalogue without deleting customer/order history.
3. Set `YUGANTH_ADMIN_PASSWORD` to your own strong password in the current terminal, then run `php bin/console.php admin your-real-email@example.com`. Clear the environment variable afterwards. Never use example credentials on a live store.
4. Run `php -S 127.0.0.1:8080 -t public`, then open http://127.0.0.1:8080.
5. Sign in at `/account.html`, then select **Open store administration**, or visit `/admin.html`.

Prices start unconfirmed with zero stock. Set real prices/stock and explicitly confirm each pack price. Checkout remains disabled until your developers configure and test the payment adapter, delivery coverage and production settings. Email and WhatsApp automation require their own provider integrations. This update does not deploy to Hostinger.

Read [Hostinger deployment](docs/HOSTINGER.md), [upgrade guide](docs/UPGRADE.md), [integrations](docs/INTEGRATIONS.md), [API](docs/API.md), and [validation](docs/VALIDATION.md).
