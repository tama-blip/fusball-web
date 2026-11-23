# FusballID Professional 2.2 — QA Notes

## Implemented
- Native Blog Studio: Markdown article body, excerpt, slug, category/tags, image upload to Cloudinary, author, CTA, Draft/Published/Scheduled.
- Public article pages at `/blog/:slug` with canonical URL, meta description, Open Graph metadata, Article JSON-LD, and sitemap/robots routes.
- Basic SEO fields: focus and secondary keywords, SEO title, meta description, short slug, and image alt text (article title/Markdown alt text).
- First-party website analytics: page views, estimated unique browser visitors, article views, daily trends, traffic sources, and CSV export.
- Analytics notice with opt-in/opt-out. Visitor ID is stored in browser localStorage; the server stores only a SHA-256 hash and does not store IP address or user-agent.
- Campaign Tracker: campaign date range, planned/published social posts, URL, format, manually entered platform insights, ERR/ERV/CTR, daily monitoring, per-platform recap, and CSV export.
- Existing external Journal Links remain available and are kept separate from native articles.
- Existing MySQL pool limit remains at 2; migration is manual and is not run during Render startup.

## Checks completed in this environment
- `node --check` passed for backend JavaScript files.
- `node --check` passed for frontend JavaScript files.
- `node --check` passed for the inline Admin CMS script.
- Local HTTP smoke checks returned HTTP 200 for `blog.html`, `blog-detail.html`, `admin/index.html`, the new marketing JavaScript files, CSS, and `robots.txt`.
- New package excludes `.env`, `.env.cloud`, other secret files, root SQL backups, `.git`, and `node_modules`. `.env.example` contains placeholders only.

## Not performed
- The Clever Cloud production database was not accessed from this build environment.
- Production backup and `migrate:marketing:cloud` were not run.
- Render deployment and authenticated Admin workflows were not executed against production.

## Required before production deployment
1. Rotate DB, Cloudinary, and JWT credentials that were present in the older uploaded archive; update Render Environment and local secret files. JWT rotation will invalidate existing sessions.
2. From the project root, run `npm.cmd run backup:cloud` with current `.env.cloud` credentials, then store the resulting SQL privately.
3. Run `npm.cmd run migrate:marketing:cloud` and confirm `MIGRASI BLOG MARKETING BERHASIL`.
4. Only after migration succeeds, commit and push the updated code to GitHub so Render deploys it.
5. Test `/api/health`, Blog Studio, article publish, public article page, Analytics, Campaign Tracker, and existing store/order/custom flows.

Do not import the whole database or drop existing tables for this upgrade.
