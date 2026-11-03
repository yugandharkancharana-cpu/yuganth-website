# Yuganth website refinement update

Upload ZIP: Yuganth-Guest-Checkout-and-Design-Update.zip

## Install in Hostinger

1. In File Manager, open Yuganth's public_html folder.
2. Download a backup of these existing files before overwriting: index.html, account.html, checkout.html, terms-and-conditions.html, privacy-policy.html and policy.css. Keep the backup outside public_html or on your computer.
3. Upload the update ZIP into public_html and extract it directly there. The ZIP's index.html must sit beside your current index.html; do not create an extra enclosing website folder.
4. Allow replacement of those six public files. The new assets go inside assets/ and the new guest endpoint goes inside api/. Existing API, payment keys, private app files, databases and media are not included or replaced. No database migration or SSH command is needed.
5. Refresh the website with Ctrl + Shift + R, or use a fresh private browser window.

## What changed

- Product browsing remains open. Checkout now accepts guest orders without account registration.
- Existing signed-in checkout remains available.
- An unchecked purchase-terms acknowledgement is shown before ordering. The guest endpoint requires it and records the policy version with the order.
- After a server-confirmed payment, the customer sees an order reference and a WhatsApp support link. Account creation is optional and offered for future purchases.
- The footer is organised into brand, Explore, Customer Care and contact information on five pages.
- Policy pages have matching branding, a desktop section sidebar, mobile section navigation, clearer spacing and restrained animation.
- Subtle product hover, cart feedback and entrance animation respect reduced-motion preferences. The current forest-green, cream and gold colours are preserved.
- Google sign-in is excluded, as requested.

## Check after extraction

- Open the homepage, account page, checkout, Terms and Privacy pages on a phone and computer. Confirm there are no missing styles and footer links work.
- Add an available pack without signing in. Enter delivery details, check the total, accept terms and confirm that a reservation and secure payment button appear. A reservation is unpaid; it does not confirm a purchase.
- Validate a successful and a cancelled/failed payment in an appropriate merchant test environment. Local tests used controlled payment responses; this ZIP has not been deployed or exercised against your live merchant account. Do not change live merchant keys simply to run a test on the public store.
- Confirm signed-in ordering still works and that a paid order appears in administration with the correct delivery details.
- If payment is debited but confirmation is delayed, use the order reference to investigate before retrying payment.

## Guest order access and communications

Guest orders use a protected server session and an internal guest owner record; creating an order does not register or sign in the customer. A different browser cannot fetch that order merely by knowing its reference. Access from checkout lasts only while the relevant server session remains valid. Keep the order reference and contact support if that session expires.

Guest checkout collects the existing recipient name, phone and address. It does not collect an email or promise email notifications. The guest owner's internal email-shaped identifier ends in @guest.yuganth.invalid and must never be used as a notification recipient. If you have a custom notification worker, handle guest orders through the actual phone/delivery details in the order and suppress delivery to that internal identifier. Existing signed-in customer notifications remain unchanged.

Earlier guest orders are not automatically attached to a subsequently created account. Automatic attachment would need a separate verified ownership flow. The post-purchase invitation clearly says the account is for future orders.

## Technical prerequisites

The update uses the current live PHP application's existing bootstrap, commerce functions, users/settings tables, Razorpay gateway and delivery rules. It supports the deployed split layout (public_html beside yuganth-app) and the repository layout (public/ beside app/). It does not expose private configuration or replace public/api/index.php.

## Validation completed

- Real local PHP HTTP tests: guest creation, CSRF checks, terms validation, server-calculated totals, duplicate-request protection, ownership isolation, account separation, cancellation and payment adapter access.
- Existing commerce suite: 29 assertions passed.
- Existing Razorpay signature/amount/order verification suite: 26 assertions passed.
- Browser flows: guest and signed-in quote → terms → reservation → mocked Razorpay callback → server-status confirmation → receipt.
- Desktop/mobile page checks, no automatic signup gate, one organised footer per page, no horizontal page overflow and reduced-motion support.

The update is prepared for manual extraction by the owner. It has not been uploaded to Hostinger during this task.
