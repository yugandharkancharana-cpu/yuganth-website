# Hostinger developer deployment

## First: staging, backup and plan compatibility

Confirm that the owner's plan supports PHP 8.3+, PDO MySQL, a MySQL/MariaDB database, cron jobs and the intended document-root layout. The exact hPanel menu and available features depend on the purchased plan. No Hostinger deployment or account configuration has been performed by this code handover.

Back up both the current WordPress files and database, and verify restoration before migration. Keep the existing live store running during development. Create a staging subdomain and protect it with hosting-level authentication. The supplied `public/robots.txt` blocks crawling but is not access control.

## Private application / public web files

Preferred layout (absolute account/domain prefixes vary):

```text
domain-directory/
  yuganth-app/
    app/
    bin/
    config/local.php
    config/config.example.php
    database/
    storage/               writable by PHP, never public
  public_html/
    index.html
    account.html
    checkout.html
    admin.html
    .htaccess
    robots.txt
    api/index.php
    assets/
```

Either point the staging document root directly at the repository's `public/` folder, or split the folders as shown. For the split layout, update the bootstrap require in `public_html/api/index.php` from `dirname(__DIR__,2) . '/app/bootstrap.php'` to the actual PRIVATE application path, for example `dirname(__DIR__,2) . '/yuganth-app/app/bootstrap.php'`. Validate this path against the account's real filesystem. Do not upload the entire repository into public_html. The root `.htaccess` denies access as defence in depth; it is not a substitute for the correct document root. The public `.htaccess` explicitly allows public files and denies dotfiles and backup/data extensions.

Do not upload `.git`, tests, private configuration, SQL dumps, runtime databases or downloaded archives into the public folder. Use SFTP, Git-based deployment or File Manager as supported by the account.

## Database and configuration

1. Create an empty MySQL database and a dedicated application database user through hPanel. Use only the necessary privileges; schema installation needs CREATE, while ordinary application operations need SELECT/INSERT/UPDATE/DELETE. InnoDB must be enabled.
2. Copy `config/config.example.php` to private `config/local.php`. Set the actual DSN (`mysql:host=localhost;dbname=...;charset=utf8mb4`), DB username/password, canonical HTTPS base URL, and `environment=production` for the final production deployment. Keep checkout disabled initially.
3. Run `php bin/console.php install` from the private application directory using Hostinger's PHP CLI path. If SSH is unavailable, import `database/schema.sql` via phpMyAdmin with InnoDB selected and ask the developer to run the seed/administrator commands through a temporary hosting cron job outside the web root. Do not expose an installation PHP page on the internet. Remove temporary setup jobs immediately.
4. The install command does not overwrite existing seed records and seeds ZERO available stock. Confirm individual pack prices, approved images and stock, then adjust through `admin.html` after creating an admin with the CLI. Pure Gold has a placeholder image.
5. Configure the payment and notification adapters as described in INTEGRATIONS.md. Add serviceable postcodes as quoted strings; configure delivery charges and threshold in integer paise.
6. Set `catalog_verified=true` only after checking real catalogue data; set `checkout_enabled=true` only after full staging acceptance. In production the payment driver must be `custom`. The example defaults are intentionally unable to accept paid orders.

## Scheduled work

Run every minute using the actual account PHP binary and private application path:

```sh
php /private/path/yuganth-app/bin/console.php expire
```

Also schedule a SINGLE `outbox` worker using a process lock (`flock` where supported). Supply `YUGANTH_NOTIFICATION_ADAPTER` in the hosting environment or a private executable wrapper outside public_html. Monitor delivery failures and implement reconciliation jobs for the selected payment provider. Never include credentials in public scripts or log output.

## HTTPS, sessions and errors

Enable and verify HTTPS before setting production mode. Secure cookies and the production API refuse plain HTTP. If a trusted reverse proxy terminates HTTPS, configure the hosting server to communicate HTTPS correctly; do not trust arbitrary client forwarded headers in application code.

Disable display_errors on production PHP and configure private error logs. Set filesystem permissions so PHP can read its config but visitors cannot. If account-level tooling cannot provide this layout, adapt deployment with Hostinger support rather than making the private application public.

## Launch acceptance

- Real Android/iPhone and tablet tests, portrait/landscape, no sideways overflow, clear text, working touch controls, visible validation and keyboard focus.
- MySQL staging tests for simultaneous checkout, last-pack stock, coupon limits, stock edits and order idempotency. Local SQLite tests do not prove MySQL concurrency.
- Provider sandbox tests for capture, cancelled payment, duplicate webhook, wrong signature/merchant/amount, expiry/cancel races, retries, reconciliation and refunds.
- Email delivery, password reset, account/session expiry, ownership restrictions, admin access and shipment notifications.
- Final legal pages, contact details, shipping/returns, privacy/terms, approved product labels/claims and applicable taxes/invoicing.
- Import existing customers/orders with an approved migration tool and a tested password strategy. This application cannot authenticate WordPress hashes automatically.
- Replace preview hash routes with final SEO URLs as required and redirect all existing important product/page URLs. Add a sitemap and final canonical metadata.

Only after acceptance, take a fresh backup and arrange the document-root/cutover and rewrite rules for the main domain. Review existing WordPress index.php and .htaccess deliberately; do not just overwrite files in a working WordPress store. Remove staging crawl restrictions from production, clear caches, check both www and non-www, then place a real controlled test order and verify payment, email and account history. Retain a rollback path and monitor failures after launch.

## Remaining product work

Payment/refund integration, notification transport and consent, tax invoices, courier automation, email verification/admin MFA, full product/media management, legal/SEO completion and migration remain developer launch work. The code provides the application core and interfaces, not preconfigured merchant services.
