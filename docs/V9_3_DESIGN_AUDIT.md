# V9.3 Design Pass

Focus: visual system and media workflow only. Checkout/payment is intentionally unchanged.

## Storefront
- Removed the boxed "F" mark from the top-left wordmark.
- Added an editorial hero canvas that starts empty instead of showing a fake demo jersey.
- Added admin-uploaded homepage hero image support through the backend.
- Added subtle reveal-on-scroll motion, ticker motion, hover motion and reduced-motion fallback.
- Product cards can display two catalog views. Hover switches FRONT -> BACK when a second image exists.
- Product detail keeps the existing gallery/lightbox.

## Product media workflow
- Admin product editor explicitly treats gallery image 01 as FRONT and image 02 as BACK.
- Existing product_images table is reused. No database migration is required.
- `/api/products` now includes gallery metadata for customer-facing cards.

## Homepage hero workflow
- `GET /api/media/site/hero` is public so the storefront can display the image.
- `POST /api/media/site/hero` is admin-only.
- `DELETE /api/media/site/hero` is admin-only.
- Files are stored in `uploads/site`.
- No hero image is required. The storefront shows an intentional editorial empty state until the admin uploads one.

## Stability
No checkout/payment architecture was changed in this pass.
