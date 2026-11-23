/**
 * Run once after deploying the marketing CMS code:
 *   node backend/migrate-marketing.js
 * This migration is intentionally NOT executed during server startup.
 */
const envPath = process.argv.includes("--cloud") ? ".env.cloud" : ".env";
require("dotenv").config({ path: envPath });
const pool = require("./db");

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(connection, table, index) {
  const [rows] = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, index]
  );
  return rows.length > 0;
}

async function addColumn(connection, table, column, definition) {
  if (!(await columnExists(connection, table, column))) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`+ ${table}.${column}`);
  } else {
    console.log(`= ${table}.${column} (sudah ada)`);
  }
}

async function main() {
  const connection = await pool.getConnection();
  try {
    await connection.query("SELECT 1");
    const [base] = await connection.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blog_posts' LIMIT 1`
    );
    if (!base.length) throw new Error("Tabel blog_posts tidak ditemukan. Pastikan database FusballID benar.");

    const [urlColumn] = await connection.query(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blog_posts' AND COLUMN_NAME = 'url' LIMIT 1`
    );
    if (urlColumn[0]?.IS_NULLABLE === "NO") {
      await connection.query("ALTER TABLE blog_posts MODIFY COLUMN url VARCHAR(1000) NULL");
      console.log("~ blog_posts.url sekarang boleh NULL (untuk artikel native)");
    }

    const columns = [
      ["slug", "VARCHAR(220) NULL"],
      ["content", "LONGTEXT NULL"],
      ["category", "VARCHAR(100) NULL"],
      ["tags", "VARCHAR(500) NULL"],
      ["focus_keyword", "VARCHAR(160) NULL"],
      ["secondary_keywords", "VARCHAR(500) NULL"],
      ["seo_title", "VARCHAR(180) NULL"],
      ["meta_description", "VARCHAR(320) NULL"],
      ["cta_label", "VARCHAR(180) NULL"],
      ["cta_url", "VARCHAR(1000) NULL"],
      ["status", "ENUM('draft','scheduled','published') NOT NULL DEFAULT 'published'"],
      ["scheduled_at", "DATETIME NULL"],
      ["published_at", "DATETIME NULL"],
      ["author_name", "VARCHAR(120) NOT NULL DEFAULT 'Fusball.id Editorial'"]
    ];
    for (const [name, definition] of columns) await addColumn(connection, "blog_posts", name, definition);

    if (!(await indexExists(connection, "blog_posts", "uq_blog_posts_slug"))) {
      await connection.query("ALTER TABLE blog_posts ADD UNIQUE KEY uq_blog_posts_slug (slug)");
      console.log("+ index uq_blog_posts_slug");
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS site_analytics_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(30) NOT NULL DEFAULT 'page_view',
        path VARCHAR(500) NOT NULL,
        article_id INT NULL,
        visitor_hash CHAR(64) NOT NULL,
        traffic_source VARCHAR(100) NOT NULL DEFAULT 'direct',
        utm_source VARCHAR(160) NULL,
        utm_medium VARCHAR(160) NULL,
        utm_campaign VARCHAR(160) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_analytics_created (created_at),
        KEY idx_analytics_article_created (article_id, created_at),
        KEY idx_analytics_source_created (traffic_source, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("= site_analytics_events siap");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        objective VARCHAR(500) NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('planned','active','completed') NOT NULL DEFAULT 'planned',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_campaign_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("= marketing_campaigns siap");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        article_id INT NULL,
        platform VARCHAR(40) NOT NULL,
        content_format VARCHAR(60) NOT NULL,
        status ENUM('planned','published') NOT NULL DEFAULT 'planned',
        scheduled_at DATETIME NULL,
        published_at DATETIME NULL,
        post_url VARCHAR(1000) NULL,
        reach BIGINT UNSIGNED NOT NULL DEFAULT 0,
        impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
        likes BIGINT UNSIGNED NOT NULL DEFAULT 0,
        comments BIGINT UNSIGNED NOT NULL DEFAULT 0,
        shares BIGINT UNSIGNED NOT NULL DEFAULT 0,
        saves BIGINT UNSIGNED NOT NULL DEFAULT 0,
        profile_visits BIGINT UNSIGNED NOT NULL DEFAULT 0,
        link_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
        notes TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_promo_campaign (campaign_id),
        KEY idx_promo_article (article_id),
        CONSTRAINT fk_promo_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        CONSTRAINT fk_promo_article FOREIGN KEY (article_id) REFERENCES blog_posts(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("= campaign_promotions siap");
    await addColumn(connection, "campaign_promotions", "caption", "TEXT NULL");
    await addColumn(connection, "campaign_promotions", "hashtags", "VARCHAR(500) NULL");
    await addColumn(connection, "campaign_promotions", "cta", "VARCHAR(300) NULL");

    await connection.query(`
      UPDATE blog_posts
      SET published_at = COALESCE(published_at, created_at)
      WHERE published = 1 AND content IS NOT NULL AND content <> '' AND published_at IS NULL
    `);

    console.log(`\nMIGRASI BLOG MARKETING BERHASIL (environment: ${envPath}).`);
    console.log("Tabel dan kolom lama dipertahankan. Tidak ada data produk/pesanan yang dihapus.");
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(async error => {
  console.error("MIGRASI GAGAL:", error.code || error.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});
