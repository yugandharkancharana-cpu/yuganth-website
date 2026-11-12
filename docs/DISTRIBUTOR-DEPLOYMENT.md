# Distributor order deployment

The public files go under the live site's public_html. The two private application changes in distributor-private.patch apply inside yuganth-app. Apply the private patch first so the existing retail shipment tools respect the distributor workflow. No database migration is needed if normal Razorpay checkout is already running.

1. Back up public_html/index.html, public_html/admin.html, yuganth-app/app/Commerce.php and yuganth-app/app/Shiprocket.php.
2. Extract the release ZIP in a temporary directory outside public_html. From the live yuganth-app directory, check the private changes with `patch --dry-run -p1 < /path/to/distributor-private.patch`. If either hunk fails, stop and apply the equivalent two guards to the live source after reviewing it. Do not replace the whole private file with a repository copy.
3. Apply the patch using `patch -p1 < /path/to/distributor-private.patch`. Run `php -l app/Commerce.php` and `php -l app/Shiprocket.php`.
4. Upload the contents of the ZIP's public_html folder into the matching live locations. Replace index.html and admin.html. Copy distributor.html beside them, distributor.php into api, and distributor.css and distributor.js into assets. Leave the existing API, payment keys and configuration in place.
5. Check the public Distributor page and sign in as an administrator. In Store administration, load Distributor products and orders. Check the default products and GST rates. Confirm the existing Razorpay settings before accepting payments.
6. For a future product, create it in Product launch & content, mark it available, then enable bulk ordering and set the applicable GST in Distributor orders. A single phone-quoted subtotal can only cover products with the same GST rate. Split orders for mixed rates.
7. After payment, compare the entered subtotal, pack sizes and quantities with the original phone quote. Resolve any mismatch before dispatch. A verified quote permits the ordinary manual shipped status. Arrange the carrier and any separate delivery charges with the distributor. The retail Shiprocket submission is blocked for distributor orders.

Default GST is 5% for Guntur Gold, Araku Gold and Spice Loom. Confirm product-specific tax and invoice treatment before enabling additional categories. A payment receipt is not a GST invoice.

