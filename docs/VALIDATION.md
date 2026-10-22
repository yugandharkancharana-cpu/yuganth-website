# Validation record — 22 October 2026

The integrated release was checked locally using PHP 8.4.26, PDO SQLite, Python's standard-library HTTP runner, Node syntax checks and the in-app browser.

- **29 commerce assertions passed:** server totals, delivery, coupon rules, stock reservation/rollback, idempotency, ownership, capture amount/state, duplicate verified payment events, cancellation/expiry and fulfilment. New checks reject coming-soon products and unconfirmed prices even if stock exists.
- **10 upgrade assertions passed:** migrate the previous schema, preserve customer/order/historic line records, retain existing prices/stock, deactivate old sizes, retire Pure Gold without deletion, create six active products, and preserve later admin decisions on repeat installation.
- **39 HTTP assertions passed:** authentication, CSRF, role checks, reset/session invalidation, addresses, admin editing, price confirmation, stale inventory checks, public catalogue visibility, coming-soon restrictions and a disabled payment webhook.
- All application PHP and JavaScript files passed syntax checks. Public HTML asset references and initial IDs were checked during packaging.
- Browser integration exercised admin sign-in, six product editors, saving a confirmed ₹270 test price and five units of stock, viewing the price on Guntur Gold, adding a 500 g pack to the bag, opening checkout, checking a configured postcode, calculating ₹60 test delivery and a ₹330 total, creating an UNPAID manual-test reservation, viewing it in account history and cancelling it. Available stock returned to five. These were synthetic local test settings, not live business prices or stock.
- The updated checkbox-based admin save controls were exercised. Admin and storefront pages had no document-level horizontal overflow at a 390 CSS-pixel viewport. The approved design previously had viewport checks at 320, 360, 390, 768 and 1440 px. Physical phones were not tested.

No actual payment, WhatsApp message, reset email or Hostinger deployment was performed. MySQL/MariaDB upgrade behavior and concurrent checkout still need staging verification. Image cutouts are AI-assisted website assets; verify final labels against approved production artwork.

The CI workflow runs syntax checks and all three backend suites. Local pass results do not imply a GitHub Actions run has completed.
