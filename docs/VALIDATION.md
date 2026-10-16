# Validation record

Validated locally on 16 October 2026 using the official PHP 8.4.26 Windows runtime, PDO SQLite, Python standard-library HTTP client and Node JavaScript syntax checking.

- All application PHP files passed syntax checks.
- All browser JavaScript files passed syntax checks.
- 27 commerce assertions passed: idempotent seeds, server prices, coupon cap and eligibility, delivery rejection, invalid quantities, duplicate-line limits, client-total tampering, inventory reservation, order idempotency, conflicting key rejection, coupon usage limit, order ownership, wrong captured amount, duplicate webhook, exactly-once notification enqueueing, paid-order cancellation rejection, fulfilment transitions, one-time restocking, expiration, late capture rejection and stock rollback.
- 30 HTTP assertions passed: session and default-disabled checkout, authentication, CSRF, registration, customer/admin access restrictions, saved-address ownership, unknown order handling, password reset enqueueing, logout, login, reset single-use and session invalidation, admin banner updates, public banner output, inventory updates, stale inventory protection, fail-closed payment webhook and storefront HTTP response.
- Static packaging checks verify local asset paths and unique initial DOM IDs on public pages.

These are development checks, not production certification. No real merchant provider, WhatsApp transport, SMTP service, courier or Hostinger account was connected. Browser rendering and real-device mobile QA remain outstanding. MySQL/MariaDB compatibility and concurrent checkout need staging verification; SQLite results do not establish MySQL locking behavior. The CI workflow is supplied; local checks do not imply GitHub Actions has run successfully.
