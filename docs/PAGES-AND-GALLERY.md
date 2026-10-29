# Separate pages and product photos

The navigation uses separate documents: index.html, pantry.html, roots.html, next.html, reviews.html and contact.html. Links load the selected page rather than scrolling through the homepage. All use the same cart, account popup, styling and shared storefront script. Existing section markup is retained in the shared shell but hidden unless it belongs to the current page.

In Admin, expand a product. The existing cover remains the main image on cards and the first photo in Explore pack. Under Extra photos, upload up to eight additional PNG, JPEG or WebP files, each at most 4 MB. Uploads are re-encoded as WebP by the existing image endpoint. Add descriptions such as Back of pack, Ingredients or Nutrition; use Move earlier / Move later to order the extra photos, then Save product. Removing a gallery entry does not delete the underlying uploaded file or change existing orders.

Explore pack shows previous/next arrows, thumbnails and a photo counter when there are multiple different photos. It supports keyboard left/right arrows. A single photo has no redundant arrows. Extra images do not appear on homepage cards or the featured hero. Actual back-of-pack artwork must be supplied; none is fabricated in this update.

The backend adds a nullable TEXT gallery_json column through the existing additive migration. Before installing on Hostinger, export the current store database and retain the SQL file privately. Run migrations only; do not reseed. The staging update installer performs the additive migration after backing up affected source files. Existing private configuration, prices, stock and historical records are preserved.

Validation added: gallery saving, ordering, removal, bounds, path restrictions, missing/remote images, authorization and five separate page responses in the HTTP suite; 13 mocked browser gallery checks. Local commerce and migration tests pass. The expanded HTTP suite and live browser inspection need confirmation by CI/staging because local execution/inspection was unavailable during preparation.
