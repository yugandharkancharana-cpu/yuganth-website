# Yuganth website

Custom responsive storefront with a PHP commerce backend and a small store administration interface. Prepared for developer integration and Hostinger deployment. **This is a development handover, not a live, certified production store.**

## Included

- Approved forest-green/ivory storefront with six transparent product cutouts, category views, spotlight carousel, mobile navigation and Our Story.
- PHP JSON API, MySQL/MariaDB deployment schema and SQLite local test support.
- Registration, sign-in/out, password hashing, CSRF protection, idle session expiry, rate limiting, password reset via notification outbox, saved addresses and order history.
- Server-authoritative prices, delivery checks, percentage coupons, transactional stock reservations, idempotent orders, expiry/cancellation, verified-payment state transition and fulfilment tracking.
- Admin screens for product descriptions/categories/visibility/launch status, confirmed variant prices, stock, percentage coupons, banner text and shipment/delivery updates.
- Payment and email/WhatsApp provider interfaces; disabled by default. Optional WhatsApp click-to-chat link.
- Automated business-rule and HTTP integration tests, plus a GitHub Actions check workflow.

## What developers still need to finish

Choose and integrate the payment SDK, browser checkout, signature-verified capture webhook, provider mapping/reconciliation and refunds. Connect transactional email (required for password recovery) and WhatsApp Business with consent/templates if wanted. Confirm catalogue/pack prices/stock, legal content, delivery areas, tax/invoicing and courier requirements. Test the layout on real phones and test MySQL under concurrency on staging. Existing WordPress customers/orders are NOT migrated automatically.

No customer data, database passwords, API keys or provider credentials are included. Fresh product prices start at zero/unconfirmed and stock starts at zero; checkout is disabled until deliberately configured. Chia Seeds, Peanuts and Ragi Flour start as coming soon. The separate Pure Gold SKU is retired without deleting historical records.

## Requirements

PHP 8.3+ with PDO, PDO MySQL for Hostinger, or PDO SQLite for local tests. MySQL 8 / compatible MariaDB with InnoDB is the intended production database. Python 3 is used only for the HTTP test runner. No frontend build is needed.

## Upgrading an existing installation

Read [UPGRADE.md](docs/UPGRADE.md) first. Back up the database, retain private configuration and storage, then run the additive installer against the SAME database. Do not replace the existing database with a fresh one. The upgrade preserves users/orders and requires price review for the new packaging.

## Local setup

```sh
cp config/config.example.php config/local.php
php bin/console.php install
php -S 127.0.0.1:8080 -t public
```

Open `http://127.0.0.1:8080`. Files opened directly with `file://` do not run PHP. Browse `account.html`, `checkout.html` and `admin.html` through the server.

Create an administrator using a unique password supplied through `YUGANTH_ADMIN_PASSWORD` in the current terminal environment, then:

```sh
php bin/console.php admin admin@your-company-domain.example
```

Use your real administrator address. Unset the password environment variable immediately afterwards; never pass the password in command arguments, commit it or share it in a chat. The command refuses to overwrite/promote an existing account.

For a local checkout test, edit the private `config/local.php`: set `checkout_enabled=true`, `catalog_verified=true`, `payment_driver=manual_test`, and list exact `serviceable_pincodes` as strings. Add stock through the admin page. Manual test orders collect no money and cannot receive paid webhooks. Production rejects this driver.

## Tests

```sh
php tests/commerce.php
php tests/migration.php
python3 tests/integration_http.py /absolute/path/to/php
```

The HTTP suite creates an isolated temporary SQLite database and starts/stops its own local PHP server. `YUGANTH_TEST_TEMP` can select a writable temporary parent directory. Test data is never sent to payment or WhatsApp providers. See `docs/VALIDATION.md` for checks actually run and outstanding verification.

## Structure

```text
public/                  ONLY this directory is web-accessible
  index.html             Approved storefront
  account.html           Customer account and orders
  checkout.html          Address, quote, order and payment handoff
  admin.html             Administrator UI (API enforces role)
  api/index.php          JSON endpoint router
  assets/                CSS, JavaScript and product images
app/                     Server services and integration interfaces
config/                  Example and private local configuration
database/schema.sql      Initial database schema
bin/console.php          Install, admin, reservation expiry, outbox
tests/                   Commerce and HTTP integration checks
docs/                    Deployment, API and provider handover
```

Start with [Hostinger deployment](docs/HOSTINGER.md), then [provider integration](docs/INTEGRATIONS.md) and [API reference](docs/API.md).

Brand colours remain editable in `public/assets/style.css`. Banner wording is editable in the admin page. Coupon rules and banner text are separate, so an advertised offer must match a valid backend coupon.

## Official references

- [Hostinger File Manager](https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/)
- [PHP session security](https://www.php.net/manual/en/session.security.ini.php)
- [PHP PDO transactions](https://www.php.net/manual/en/pdo.transactions.php)

Company-specific assets and source are supplied for Yuganth's developer handover; no open-source licence is granted by this repository.
