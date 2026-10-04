# V10 Editorial CMS

Fusball.id now includes a professional editorial layer without removing existing assets or storefront files.

## Added
- `/blog.html`: Journal page for external article links.
- Admin > Journal / Blog: CRUD for title, external URL, excerpt, thumbnail URL, ordering, and visibility.
- Admin > Web Team: CRUD for designer/developer profiles, role, bio, photo URL, Instagram URL, ordering, and visibility.
- `/about.html`: public Web Team section.
- Main navigation/footer: Journal link.
- MySQL tables are created automatically at startup, so the feature does not require deleting or rebuilding the existing database.

## Asset preservation
All existing `frontend/assets`, uploaded files, product images, and existing application files are retained in this package.
