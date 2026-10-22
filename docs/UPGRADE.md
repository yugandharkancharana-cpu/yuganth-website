# Upgrade to the six-product design

This release combines the approved forest-green/ivory design, transparent product cutouts, PHP backend, account pages, checkout and administrator interface. It updates the same repository; it does not deploy to Hostinger automatically.

## Back up and preserve local data

1. Stop your local PHP server with Ctrl+C. For a hosted installation, use a maintenance window and a tested staging deployment.
2. Make a separate backup of the complete old application folder and database. For SQLite, copy the database only after all writers are stopped. For MySQL, export a consistent backup and test restoration.
3. Replace application source with this release, retaining your PRIVATE `config/local.php` and `storage/` folder. These are intentionally absent from GitHub and download packages. Do not overwrite the existing database with an empty one. Keep server credentials outside public_html.
4. With the SAME database configuration, run:

```sh
php bin/console.php install
```

5. Restart the local website:

```sh
php -S 127.0.0.1:8080 -t public
```

Use PHP 8.3+ with PDO SQLite for a local SQLite database, or PDO MySQL for MySQL. On Windows where PHP is not in PATH, use the full path to php.exe as in the earlier local setup, and enable PDO SQLite in its PHP configuration. No default administrator password is installed by this release. Existing accounts remain in the existing database.

## What the migration does

- Adds `products.launch_status`, `products.origin`, `variants.price_confirmed` and the `schema_migrations` table when needed.
- Creates Chia Seeds, Peanuts and Ragi Flour as coming soon. All six fresh-install products start with a 500 g variant, price zero/unconfirmed and zero stock. No real prices are invented.
- Updates the three existing spice products to the new categories, origins and cutout images. Their existing names, descriptions, stock and price amounts are preserved.
- Retains older 100/250/1000 g spice variants but deactivates them for review because the supplied new artwork shows only 500 g. No historical order item or variant is deleted.
- Retires the separate Pure Gold SKU from public browsing while retaining its database records for existing order history.
- Requires one-time price confirmation for the new six-product catalogue. Re-running install preserves later admin launch decisions and price confirmations.
- Retains users, password hashes, addresses, orders, coupons, payment events and notification outbox records.

The migration is designed for the previous repository schema. Back up first and test against your actual database on staging. Initial/upgrade schema operations use DDL; MySQL does not make all DDL transactional. Do not run multiple schema installers concurrently. Restore a backup if deployment validation fails rather than attempting to delete historical records.

## Admin tasks after upgrade

Sign in at `account.html`, then open `admin.html`.

1. Expand a product under **Product launch & content** to edit its name, description, origin, category, launch status and visibility.
2. Under **Pack prices & stock**, set the actual price in paise and available stock. Tick **Price confirmed** only when the entered price has been approved. A zero price cannot be confirmed.
3. Coming-soon products cannot be quoted or ordered even when stock and a price have been entered. Set launch status to available only when approved for sale.
4. Existing older variants remain visible in admin for review. Enable them only if their pack sizes and labels are valid for the final catalogue.
5. Coupons, offer-banner text and fulfilment status are managed in the same admin page.

Changing product availability does not enable the whole checkout. The private server configuration must also enable checkout and catalogue verification, and production requires a configured live payment adapter. Defaults remain disabled.

## Cart compatibility

The storefront and checkout now share a variant-ID cart (`yuganth-cart-v2`) with quantities. Old design-preview bags and the earlier numeric-index demo cart are intentionally not converted because their item mapping and prices are not reliable for the new catalogue. This affects only browser-local unsubmitted carts, not stored orders or customer accounts.

## Before production

Complete the payment/refund/reconciliation and email/WhatsApp integrations in INTEGRATIONS.md. Confirm final labels, images, prices, legal policies, shipping and tax requirements. Test MySQL concurrency, production HTTPS and physical mobile devices. This release has local SQLite and browser checks; it is not a substitute for the staging acceptance process in HOSTINGER.md.
