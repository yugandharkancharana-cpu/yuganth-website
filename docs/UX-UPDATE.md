# Pack sizes and shopping update — 29 October 2026

- Admin: create any whole-gram pack from 1 g through 25000 g; 1 kg is entered as 1000. Price is entered in rupees, stored as integer paise. Each size has independent stock, active and price-confirmed settings. Duplicate sizes are rejected. Deactivate a size instead of deleting records referenced by old orders.
- Storefront: packet motion is clipped inside the image stage. Explore pack is a full-width 48 px action below the price. Available sizes appear in ascending weight order; the first sellable size is preselected.
- Account: compact sign-in/signup tabs, homepage and checkout popup, existing password-reset and order-history flows retained.
- Checkout: compact delivery layout, order summary above the form on mobile, collapsible coupon field and account popup without losing entered address fields.
- Reset email: private SMTP configuration and reset-only cron worker; see ACCOUNT-AND-EMAIL.md. Requires mailbox configuration and a real delivery test.

No production files, live payment keys, server settings or databases are changed by preparing this source package. The update needs installing on staging. Existing prices, pack stock, users and orders are not reseeded. No database install command is needed for this update.

Validation: 76 HTTP integration assertions (11 new pack-size assertions), 29 commerce, 10 migration, 26 Razorpay, 13 mocked Razorpay browser and 4 mocked reset-email assertions: 158 total. JavaScript and PHP syntax checked. Local browser inspection: 390 px account/signup, 1 kg selection through checkout; all six card actions measured at least 48 px tall and inside their cards without image overlap. Desktop checkout at 1280 px has two columns without horizontal page overflow. Hostinger Apache account framing headers and real SMTP acceptance/inbox delivery still require staging verification. Real gateway capture and webhook delivery remain launch checks.
