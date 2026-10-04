# V8 Media Management

## What is new
- Product gallery uploads to server storage.
- Product gallery is stored in `product_images`.
- First uploaded image becomes the main `products.image_url` when no main image exists.
- Product detail shows thumbnails and a lightbox.
- Admin can delete gallery images.
- Custom jersey reference upload is stored under `uploads/custom`.
- Admin custom request detail shows the actual reference image.

## Supported image types
- JPG / JPEG
- PNG
- WEBP

## Limits
- Product uploads: up to 8 files per upload, 8 MB per file.
- Custom request reference: 10 MB.

## Storage
Local development storage:
- `uploads/products/`
- `uploads/custom/`

For production, move these assets to object storage/CDN and store public URLs in MySQL.
