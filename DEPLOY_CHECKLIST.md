# FusballID 2.2 — Upgrade & Deploy Checklist

## Before touching production

1. Rotate credentials that were present in the older uploaded archive:
   - Clever Cloud MySQL password.
   - Cloudinary API key and API secret.
   - JWT secret (this invalidates existing login sessions).
2. Update the new values in Render → `fusball-web` → Environment and in your local `.env` / `.env.cloud` files. This package intentionally does not contain those files.
3. Close unused Admin tabs and other database clients before backup/migration. The Clever Cloud DEV database has a low concurrent-connection limit.

## Backup production database first

From the project root in PowerShell:

```powershell
npm.cmd run backup:cloud
```

The script reads `.env.cloud`, exports all base tables (schema and rows) through `mysql2`, and creates a timestamped `fusball_id_backup_*.sql` in the project root. Keep that file private and outside GitHub.

## Migrate the existing Clever Cloud database

Only after the backup succeeded:

```powershell
npm.cmd run migrate:marketing:cloud
```

Expected final message: `MIGRASI BLOG MARKETING BERHASIL`.

The migration adds the article/SEO fields and creates analytics/campaign tables. It does not drop product, order, user, or existing Journal Links data. It is intentionally not run by server startup.

## Test locally (optional but recommended)

```powershell
npm.cmd install
npm.cmd start
```

Check:
- `http://localhost:3000/api/health`
- `http://localhost:3000/blog.html`
- `http://localhost:3000/sitemap.xml`
- Admin → Blog Studio, Analytics, Campaign Tracker.

## Deploy code after migration

```powershell
git status
git add backend frontend database package.json package-lock.json README.md DEPLOY_CHECKLIST.md .env.example .gitignore
git commit -m "Upgrade FusballID blog marketing CMS"
git push origin main
```

Wait for Render to show **Live**, then test:

- `https://fusball-web.onrender.com/api/health`
- `https://fusball-web.onrender.com/blog.html`
- `https://fusball-web.onrender.com/robots.txt`
- `https://fusball-web.onrender.com/sitemap.xml`
- Login to Admin and test Blog Studio, Analytics, and Campaign Tracker.

## Important

- Do not run the reference SQL file manually when using the JS migration command.
- Do not drop/import the entire database for this upgrade.
- Keep `connectionLimit: 2`; the database DEV plan has a five-connection account limit.
- If a migration or deploy fails, stop and inspect the exact error before retrying. Do not repeat imports or reset data blindly.
