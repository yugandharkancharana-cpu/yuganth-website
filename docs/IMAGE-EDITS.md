# Product image background cleanup

Built-in image editing was used for six background-extraction requests, one per supplied product image. No CLI/API-key fallback was used. Original source photographs and the previous framed preview are retained.

Shared prompt (with PRODUCT replaced for each asset):

> Use case: background-extraction. Edit target: the supplied Yuganth PRODUCT product photograph. Remove ONLY the external beige studio backdrop, tabletop, ground shadow, and all pixels outside the stand-up pouch silhouette. Return the exact same full front-facing pouch isolated on a genuinely transparent alpha background, clean precise natural edges including top corners, resealable zipper, side notches and curved base. Preserve every pixel/detail of the pouch as faithfully as possible: exact original colour, lighting, fabric texture, all typography, brand name YUGANTH, product name PRODUCT, all package printing and food illustrations, net weight and all proportions. Do not redesign, redraw or reword any label. Do not remove the illustrations printed on the pouch. No frame, no background colour, no checkerboard baked into the image, no added shadow or reflection. One isolated pouch only, centered, upright, complete silhouette with small transparent margin.

PRODUCT values: GUNTUR GOLD, ARAKU GOLD, SPICE LOOM, CHIA SEEDS, PEANUTS and RAGI FLOUR.

The resulting alpha images were resized into consistent 800 × 1200 transparent WebP canvases for website use. The output files are assets/guntur-gold-cutout.webp, assets/araku-gold-cutout.webp, assets/spice-loom-cutout.webp, assets/chia-seeds-cutout.webp, assets/peanuts-cutout.webp and assets/ragi-flour-cutout.webp. The website uses CSS shadows rather than a baked-in tabletop or image frame.

These are AI-assisted website cutouts, not print-ready packaging artwork. Use the approved original production artwork for printing and final label verification.
