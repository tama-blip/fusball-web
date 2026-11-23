-- Referensi skema saja. Untuk database existing, gunakan `npm run migrate:marketing` atau `npm run migrate:marketing:cloud` agar migrasi berjalan idempotent.
-- FusballID Blog Marketing Upgrade
-- Use backend/migrate-marketing.js for the idempotent migration.
-- This SQL file is a human-readable reference; do not import it repeatedly.

ALTER TABLE blog_posts MODIFY COLUMN url VARCHAR(1000) NULL;
ALTER TABLE blog_posts
  ADD COLUMN slug VARCHAR(220) NULL,
  ADD COLUMN content LONGTEXT NULL,
  ADD COLUMN category VARCHAR(100) NULL,
  ADD COLUMN tags VARCHAR(500) NULL,
  ADD COLUMN focus_keyword VARCHAR(160) NULL,
  ADD COLUMN secondary_keywords VARCHAR(500) NULL,
  ADD COLUMN seo_title VARCHAR(180) NULL,
  ADD COLUMN meta_description VARCHAR(320) NULL,
  ADD COLUMN cta_label VARCHAR(180) NULL,
  ADD COLUMN cta_url VARCHAR(1000) NULL,
  ADD COLUMN status ENUM('draft','scheduled','published') NOT NULL DEFAULT 'published',
  ADD COLUMN scheduled_at DATETIME NULL,
  ADD COLUMN published_at DATETIME NULL,
  ADD COLUMN author_name VARCHAR(120) NOT NULL DEFAULT 'Fusball.id Editorial',
  ADD UNIQUE KEY uq_blog_posts_slug (slug);

-- The analytics and campaign tables are created by migrate-marketing.js.
-- campaign_promotions additionally receives caption, hashtags, and cta columns.
