const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const cloudinary = require("../config/cloudinary");
const { blogUpload } = require("../middleware/upload.middleware");
const { authenticate, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();
const adminOnly = [authenticate, requireRole("admin")];
const allowedPlatforms = new Set(["instagram", "tiktok", "facebook", "linkedin", "other"]);
const allowedFormats = new Set(["feed", "carousel", "reels", "story", "video", "shorts", "post", "other"]);

const slugify = value => String(value || "")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);

const cleanText = (value, max = 1000) => String(value ?? "").trim().slice(0, max);
const isCloudinary = value => typeof value === "string" && value.includes("res.cloudinary.com");

async function uploadThumbnail(file) {
  if (!file?.path) return null;
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "fusball_id/blog",
      resource_type: "image",
      transformation: [{ width: 1800, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }]
    });
    return { url: result.secure_url, publicId: result.public_id };
  } finally {
    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }
}

async function removeCloudinary(url) {
  if (!isCloudinary(url)) return;
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index < 0) return;
  let publicId = url.slice(index + marker.length).replace(/^v\d+\//, "").replace(/\.[^/.]+$/, "");
  if (publicId) {
    try { await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true }); }
    catch (error) { console.error("[Marketing] Cloudinary cleanup failed:", error.message); }
  }
}

function scheduleIsValid(status, scheduledAt) {
  if (status !== "scheduled") return true;
  return Boolean(scheduledAt && !Number.isNaN(new Date(scheduledAt).getTime()));
}

async function buildUniqueSlug(connection, requested, title, excludeId = null) {
  const base = slugify(requested || title) || "artikel";
  let candidate = base;
  let suffix = 2;
  while (true) {
    const sql = excludeId
      ? "SELECT id FROM blog_posts WHERE slug = ? AND id <> ? LIMIT 1"
      : "SELECT id FROM blog_posts WHERE slug = ? LIMIT 1";
    const params = excludeId ? [candidate, excludeId] : [candidate];
    const [rows] = await connection.query(sql, params);
    if (!rows.length) return candidate;
    candidate = `${base}-${suffix++}`;
    if (suffix > 1000) throw new Error("Tidak dapat membuat slug unik.");
  }
}

// Public native article listing. Legacy external links remain available from /api/blog.
router.get("/api/marketing/articles", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id,title,excerpt,slug,image_url,category,tags,focus_keyword,author_name,published_at,scheduled_at,created_at
       FROM blog_posts
       WHERE content IS NOT NULL AND content <> ''
         AND ((status = 'published' AND published = 1) OR (status = 'scheduled' AND scheduled_at <= NOW()))
       ORDER BY COALESCE(published_at, scheduled_at, created_at) DESC, id DESC`
    );
    res.json(rows);
  } catch (error) { next(error); }
});

router.get("/api/marketing/articles/:slug", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id,title,excerpt,slug,content,image_url,category,tags,focus_keyword,secondary_keywords,
              seo_title,meta_description,cta_label,cta_url,author_name,published_at,scheduled_at,created_at
       FROM blog_posts
       WHERE slug = ? AND content IS NOT NULL AND content <> ''
         AND ((status = 'published' AND published = 1) OR (status = 'scheduled' AND scheduled_at <= NOW()))
       LIMIT 1`,
      [cleanText(req.params.slug, 220)]
    );
    if (!rows.length) return res.status(404).json({ message: "Artikel tidak ditemukan." });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

// Server-render SEO metadata for social previews and crawlers.
router.get("/blog/:slug", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id,title,excerpt,slug,image_url,seo_title,meta_description,cta_label,cta_url,author_name,published_at,scheduled_at,created_at
       FROM blog_posts
       WHERE slug = ? AND content IS NOT NULL AND content <> ''
         AND ((status = 'published' AND published = 1) OR (status = 'scheduled' AND scheduled_at <= NOW()))
       LIMIT 1`,
      [cleanText(req.params.slug, 220)]
    );
    if (!rows.length) return res.status(404).sendFile(path.join(__dirname, "../../frontend/404.html"), error => {
      if (error) res.status(404).send("Artikel tidak ditemukan.");
    });

    const article = rows[0];
    const template = fs.readFileSync(path.join(__dirname, "../../frontend/blog-detail.html"), "utf8");
    const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const title = escape(article.seo_title || article.title);
    const description = escape(article.meta_description || article.excerpt || article.title).slice(0, 320);
    const publicOrigin = (process.env.PUBLIC_BASE_URL || "https://fusball-web.onrender.com").replace(/\/$/, "");
    const canonical = `${publicOrigin}/blog/${encodeURIComponent(article.slug)}`;
    const image = escape(article.image_url || "");
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org", "@type": "Article", headline: article.title,
      description: article.meta_description || article.excerpt || "", image: article.image_url || undefined,
      author: { "@type": "Organization", name: article.author_name || "Fusball.id" },
      datePublished: article.published_at || article.scheduled_at || article.created_at, mainEntityOfPage: canonical
    }).replace(/</g, "\\u003c");

    const html = template
      .replaceAll("%%SEO_TITLE%%", title)
      .replaceAll("%%SEO_DESCRIPTION%%", description)
      .replaceAll("%%SEO_CANONICAL%%", escape(canonical))
      .replaceAll("%%SEO_IMAGE%%", image)
      .replaceAll("%%ARTICLE_ID%%", String(article.id))
      .replace("%%SEO_JSONLD%%", jsonLd);
    res.type("html").send(html);
  } catch (error) { next(error); }
});

router.get("/robots.txt", (_req, res) => {
  const origin = (process.env.PUBLIC_BASE_URL || "https://fusball-web.onrender.com").replace(/\/$/, "");
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${origin}/sitemap.xml\n`);
});

router.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT slug, COALESCE(published_at, scheduled_at, created_at) AS modified_at FROM blog_posts
       WHERE slug IS NOT NULL AND content IS NOT NULL AND content <> ''
         AND ((status = 'published' AND published = 1) OR (status = 'scheduled' AND scheduled_at <= NOW()))
       ORDER BY modified_at DESC`
    );
    const origin = (process.env.PUBLIC_BASE_URL || "https://fusball-web.onrender.com").replace(/\/$/, "");
    const urls = ["/", "/shop.html", "/about.html", "/blog.html", "/contact.html", ...rows.map(x => `/blog/${encodeURIComponent(x.slug)}`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${origin}${url}</loc></url>`).join("")}</urlset>`;
    res.type("application/xml").send(xml);
  } catch (error) { next(error); }
});

// Anonymous first-party page analytics. The browser sends a random local ID;
// the server stores only its SHA-256 hash, never IP address or user agent.
router.post("/api/marketing/track", async (req, res, next) => {
  try {
    const visitorId = cleanText(req.body?.visitor_id, 120);
    const pagePath = cleanText(req.body?.path, 500);
    if (!visitorId || !pagePath || !pagePath.startsWith("/")) return res.status(400).json({ message: "Event analytics tidak valid." });
    const articleId = Number(req.body?.article_id) || null;
    const visitorHash = crypto.createHash("sha256").update(visitorId).digest("hex");
    let source = cleanText(req.body?.utm_source, 100).toLowerCase();
    if (!source) {
      const referrer = cleanText(req.body?.referrer, 1000);
      try {
        const host = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
        source = !host ? "direct" : host.includes("instagram") ? "instagram" : host.includes("tiktok") ? "tiktok" : host.includes("facebook") ? "facebook" : host.includes("google") ? "google" : "referral";
      } catch { source = "direct"; }
    }
    await pool.query(
      `INSERT INTO site_analytics_events
       (event_type,path,article_id,visitor_hash,traffic_source,utm_source,utm_medium,utm_campaign)
       VALUES ('page_view',?,?,?,?,?,?,?)`,
      [pagePath, articleId, visitorHash, source, cleanText(req.body?.utm_source,160) || null,
       cleanText(req.body?.utm_medium,160) || null, cleanText(req.body?.utm_campaign,160) || null]
    );
    res.status(202).json({ tracked: true });
  } catch (error) { next(error); }
});

router.get("/api/marketing/admin/articles", ...adminOnly, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id,title,excerpt,url,slug,content,image_url,category,tags,focus_keyword,secondary_keywords,
              seo_title,meta_description,cta_label,cta_url,status,scheduled_at,published_at,author_name,published,sort_order,created_at,updated_at
       FROM blog_posts WHERE content IS NOT NULL AND content <> '' ORDER BY updated_at DESC, id DESC`
    );
    res.json(rows);
  } catch (error) { next(error); }
});

router.post("/api/marketing/admin/articles", ...adminOnly, blogUpload.single("thumbnail"), async (req, res, next) => {
  let uploaded = null;
  try {
    const title = cleanText(req.body.title, 180);
    const content = String(req.body.content || "").trim();
    const excerpt = cleanText(req.body.excerpt, 2000);
    const status = ["draft", "scheduled", "published"].includes(req.body.status) ? req.body.status : "draft";
    const scheduledAt = req.body.scheduled_at ? new Date(req.body.scheduled_at) : null;
    if (!title || !content) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Judul dan isi artikel wajib diisi." });
    }
    if (content.length > 100000) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Isi artikel maksimal 100.000 karakter." });
    }
    if (!scheduleIsValid(status, scheduledAt)) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Tanggal publikasi terjadwal tidak valid." });
    }
    if (status !== "draft" && !req.file) return res.status(400).json({ message: "Thumbnail utama wajib diunggah sebelum artikel dijadwalkan atau dipublikasikan." });

    if (req.file) uploaded = await uploadThumbnail(req.file);
    const connection = await pool.getConnection();
    try {
      const slug = await buildUniqueSlug(connection, req.body.slug, title);
      const published = status === "published" ? 1 : 0;
      const publishedAt = published ? new Date() : null;
      const [result] = await connection.query(
        `INSERT INTO blog_posts
         (title,excerpt,url,image_url,published,sort_order,slug,content,category,tags,focus_keyword,secondary_keywords,seo_title,meta_description,cta_label,cta_url,status,scheduled_at,published_at,author_name)
         VALUES (?,?,NULL,?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [title, excerpt, uploaded?.url || null, published, slug, content,
         cleanText(req.body.category,100) || null, cleanText(req.body.tags,500) || null,
         cleanText(req.body.focus_keyword,160) || null, cleanText(req.body.secondary_keywords,500) || null,
         cleanText(req.body.seo_title,180) || null, cleanText(req.body.meta_description,320) || excerpt.slice(0,320) || null,
         cleanText(req.body.cta_label,180) || null, cleanText(req.body.cta_url,1000) || null,
         status, scheduledAt && status === "scheduled" ? scheduledAt : null, publishedAt,
         cleanText(req.body.author_name,120) || "Fusball.id Editorial"]
      );
      res.status(201).json({ id: result.insertId, slug, message: "Artikel berhasil disimpan." });
    } finally { connection.release(); }
  } catch (error) {
    if (uploaded?.publicId) {
      try { await cloudinary.uploader.destroy(uploaded.publicId, { resource_type: "image", invalidate: true }); } catch {}
    }
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
});

router.put("/api/marketing/admin/articles/:id", ...adminOnly, blogUpload.single("thumbnail"), async (req, res, next) => {
  let uploaded = null;
  try {
    const id = Number(req.params.id);
    const title = cleanText(req.body.title, 180);
    const content = String(req.body.content || "").trim();
    const excerpt = cleanText(req.body.excerpt, 2000);
    const status = ["draft", "scheduled", "published"].includes(req.body.status) ? req.body.status : "draft";
    const scheduledAt = req.body.scheduled_at ? new Date(req.body.scheduled_at) : null;
    if (!Number.isInteger(id) || id < 1 || !title || !content) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Data artikel belum valid." });
    }
    if (content.length > 100000) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Isi artikel maksimal 100.000 karakter." });
    }
    if (!scheduleIsValid(status, scheduledAt)) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Tanggal publikasi terjadwal tidak valid." });
    }

    const [existingRows] = await pool.query("SELECT image_url, published_at FROM blog_posts WHERE id=? AND content IS NOT NULL AND content <> '' LIMIT 1", [id]);
    if (!existingRows.length) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Artikel tidak ditemukan." });
    }

    const oldImage = existingRows[0].image_url;
    if (status !== "draft" && !req.file && !oldImage) {
      return res.status(400).json({ message: "Thumbnail utama wajib diunggah sebelum artikel dijadwalkan atau dipublikasikan." });
    }
    if (req.file) uploaded = await uploadThumbnail(req.file);
    const newImage = uploaded?.url || oldImage;
    const published = status === "published" ? 1 : 0;
    const publishedAt = published ? (existingRows[0].published_at || new Date()) : null;
    const connection = await pool.getConnection();
    try {
      const slug = await buildUniqueSlug(connection, req.body.slug, title, id);
      await connection.query(
        `UPDATE blog_posts SET title=?,excerpt=?,url=NULL,image_url=?,published=?,slug=?,content=?,category=?,tags=?,
         focus_keyword=?,secondary_keywords=?,seo_title=?,meta_description=?,cta_label=?,cta_url=?,status=?,scheduled_at=?,published_at=?,author_name=?,sort_order=?
         WHERE id=?`,
        [title, excerpt, newImage, published, slug, content,
         cleanText(req.body.category,100) || null, cleanText(req.body.tags,500) || null,
         cleanText(req.body.focus_keyword,160) || null, cleanText(req.body.secondary_keywords,500) || null,
         cleanText(req.body.seo_title,180) || null, cleanText(req.body.meta_description,320) || excerpt.slice(0,320) || null,
         cleanText(req.body.cta_label,180) || null, cleanText(req.body.cta_url,1000) || null,
         status, scheduledAt && status === "scheduled" ? scheduledAt : null, publishedAt,
         cleanText(req.body.author_name,120) || "Fusball.id Editorial", Number(req.body.sort_order) || 0, id]
      );
    } finally { connection.release(); }
    if (uploaded && oldImage && oldImage !== newImage) await removeCloudinary(oldImage);
    res.json({ message: "Artikel diperbarui.", slug });
  } catch (error) {
    if (uploaded?.publicId) {
      try { await cloudinary.uploader.destroy(uploaded.publicId, { resource_type: "image", invalidate: true }); } catch {}
    }
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
});

router.delete("/api/marketing/admin/articles/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "ID artikel tidak valid." });
    const [rows] = await pool.query("SELECT image_url FROM blog_posts WHERE id=? AND content IS NOT NULL AND content <> '' LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Artikel native tidak ditemukan." });
    await pool.query("DELETE FROM blog_posts WHERE id=?", [id]);
    await removeCloudinary(rows[0].image_url);
    res.json({ message: "Artikel dihapus." });
  } catch (error) { next(error); }
});

router.get("/api/marketing/admin/analytics", ...adminOnly, async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 10));
    const since = `${days} DAY`;
    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS visitors,
              COUNT(DISTINCT CASE WHEN article_id IS NOT NULL THEN visitor_hash END) AS article_visitors,
              SUM(article_id IS NOT NULL) AS article_views
       FROM site_analytics_events WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`
    );
    const [daily] = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS visitors
       FROM site_analytics_events WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
       GROUP BY DATE(created_at) ORDER BY day ASC`
    );
    const [topArticles] = await pool.query(
      `SELECT b.id,b.title,b.slug,COUNT(e.id) AS views,COUNT(DISTINCT e.visitor_hash) AS visitors
       FROM site_analytics_events e JOIN blog_posts b ON b.id=e.article_id
       WHERE e.created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
       GROUP BY b.id,b.title,b.slug ORDER BY views DESC LIMIT 10`
    );
    const [sources] = await pool.query(
      `SELECT traffic_source AS source,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors
       FROM site_analytics_events WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
       GROUP BY traffic_source ORDER BY views DESC`
    );
    res.json({ period_days: days, totals: { ...totals, page_views: Number(totals.page_views || 0), visitors: Number(totals.visitors || 0), article_visitors: Number(totals.article_visitors || 0), article_views: Number(totals.article_views || 0) }, daily, top_articles: topArticles, sources });
  } catch (error) { next(error); }
});

router.get("/api/marketing/admin/campaigns", ...adminOnly, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, COUNT(p.id) AS promotion_count,
              SUM(CASE WHEN p.status = 'published'
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) >= c.start_date
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) < DATE_ADD(c.end_date, INTERVAL 1 DAY)
                       THEN 1 ELSE 0 END) AS published_promotion_count,
              COALESCE(SUM(CASE WHEN p.status = 'published'
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) >= c.start_date
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) < DATE_ADD(c.end_date, INTERVAL 1 DAY)
                       THEN p.reach ELSE 0 END),0) AS total_reach,
              COALESCE(SUM(CASE WHEN p.status = 'published'
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) >= c.start_date
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) < DATE_ADD(c.end_date, INTERVAL 1 DAY)
                       THEN p.impressions ELSE 0 END),0) AS total_impressions,
              COALESCE(SUM(CASE WHEN p.status = 'published'
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) >= c.start_date
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) < DATE_ADD(c.end_date, INTERVAL 1 DAY)
                       THEN p.likes+p.comments+p.shares+p.saves ELSE 0 END),0) AS total_engagement,
              COALESCE(SUM(CASE WHEN p.status = 'published'
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) >= c.start_date
                        AND COALESCE(p.published_at,p.scheduled_at,p.created_at) < DATE_ADD(c.end_date, INTERVAL 1 DAY)
                       THEN p.link_clicks ELSE 0 END),0) AS total_link_clicks
       FROM marketing_campaigns c LEFT JOIN campaign_promotions p ON p.campaign_id=c.id
       GROUP BY c.id ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (error) { next(error); }
});

router.post("/api/marketing/admin/campaigns", ...adminOnly, async (req, res, next) => {
  try {
    const name = cleanText(req.body.name,180);
    const objective = cleanText(req.body.objective,500);
    const startDate = cleanText(req.body.start_date,10);
    const endDate = cleanText(req.body.end_date,10);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
      return res.status(400).json({ message: "Nama dan rentang tanggal kampanye harus valid." });
    }
    const [result] = await pool.query(
      "INSERT INTO marketing_campaigns(name,objective,start_date,end_date,status) VALUES (?,?,?,?,'planned')",
      [name, objective || null, startDate, endDate]
    );
    res.status(201).json({ id: result.insertId, message: "Kampanye dibuat." });
  } catch (error) { next(error); }
});

router.put("/api/marketing/admin/campaigns/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = cleanText(req.body.name,180);
    const objective = cleanText(req.body.objective,500);
    const startDate = cleanText(req.body.start_date,10);
    const endDate = cleanText(req.body.end_date,10);
    const status = ["planned", "active", "completed"].includes(req.body.status) ? req.body.status : "planned";
    if (!Number.isInteger(id) || !name || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) return res.status(400).json({ message: "Data kampanye belum valid." });
    await pool.query("UPDATE marketing_campaigns SET name=?,objective=?,start_date=?,end_date=?,status=? WHERE id=?", [name, objective || null, startDate, endDate, status, id]);
    res.json({ message: "Kampanye diperbarui." });
  } catch (error) { next(error); }
});

router.delete("/api/marketing/admin/campaigns/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "ID kampanye tidak valid." });
    await pool.query("DELETE FROM marketing_campaigns WHERE id=?", [id]);
    res.json({ message: "Kampanye dihapus." });
  } catch (error) { next(error); }
});

router.get("/api/marketing/admin/campaigns/:id/monitoring", ...adminOnly, async (req, res, next) => {
  try {
    const campaignId = Number(req.params.id);
    if (!Number.isInteger(campaignId) || campaignId < 1) return res.status(400).json({ message: "ID kampanye tidak valid." });
    const [campaignRows] = await pool.query(
      `SELECT DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date
       FROM marketing_campaigns WHERE id=? LIMIT 1`,
      [campaignId]
    );
    if (!campaignRows.length) return res.status(404).json({ message: "Kampanye tidak ditemukan." });
    const { start_date: startDate, end_date: endDate } = campaignRows[0];
    const dayCount = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
    if (dayCount < 1 || dayCount > 90) return res.status(400).json({ message: "Rentang monitoring harus 1–90 hari." });

    const [cmsRows] = await pool.query(
      `SELECT DATE_FORMAT(created_at,'%Y-%m-%d') AS day,
              COUNT(*) AS page_views, COUNT(DISTINCT visitor_hash) AS visitors
       FROM site_analytics_events
       WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY DATE(created_at) ORDER BY day ASC`,
      [startDate, endDate]
    );
    const [articleRows] = await pool.query(
      `SELECT id,title,DATE_FORMAT(COALESCE(published_at,scheduled_at,created_at),'%Y-%m-%d') AS day
       FROM blog_posts
       WHERE content IS NOT NULL AND content <> ''
         AND ((status='published' AND published=1) OR (status='scheduled' AND scheduled_at <= NOW()))
         AND COALESCE(published_at,scheduled_at,created_at) >= ?
         AND COALESCE(published_at,scheduled_at,created_at) < DATE_ADD(?, INTERVAL 1 DAY)
       ORDER BY day ASC, id ASC`,
      [startDate, endDate]
    );
    const [promotionRows] = await pool.query(
      `SELECT DATE_FORMAT(COALESCE(published_at,scheduled_at,created_at),'%Y-%m-%d') AS day,
              platform, COUNT(*) AS posts, SUM(reach) AS reach, SUM(impressions) AS impressions,
              SUM(likes) AS likes, SUM(comments) AS comments, SUM(shares) AS shares,
              SUM(saves) AS saves, SUM(profile_visits) AS profile_visits, SUM(link_clicks) AS link_clicks
       FROM campaign_promotions
       WHERE campaign_id=? AND status='published'
         AND COALESCE(published_at,scheduled_at,created_at) >= ?
         AND COALESCE(published_at,scheduled_at,created_at) < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY DATE(COALESCE(published_at,scheduled_at,created_at)), platform
       ORDER BY day ASC, platform ASC`,
      [campaignId, startDate, endDate]
    );
    const [platformRows] = await pool.query(
      `SELECT platform, COUNT(*) AS posts, SUM(reach) AS reach, SUM(impressions) AS impressions,
              SUM(likes) AS likes, SUM(comments) AS comments, SUM(shares) AS shares,
              SUM(saves) AS saves, SUM(profile_visits) AS profile_visits, SUM(link_clicks) AS link_clicks
       FROM campaign_promotions WHERE campaign_id=? AND status='published'
         AND COALESCE(published_at,scheduled_at,created_at) >= ?
         AND COALESCE(published_at,scheduled_at,created_at) < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY platform ORDER BY platform ASC`,
      [campaignId, startDate, endDate]
    );

    const cmsByDay = new Map(cmsRows.map(row => [row.day, row]));
    const articlesByDay = new Map();
    for (const article of articleRows) {
      if (!articlesByDay.has(article.day)) articlesByDay.set(article.day, []);
      articlesByDay.get(article.day).push({ id: article.id, title: article.title });
    }
    const promotionsByDay = new Map();
    for (const row of promotionRows) {
      if (!promotionsByDay.has(row.day)) promotionsByDay.set(row.day, []);
      const numeric = { ...row };
      for (const key of ["posts","reach","impressions","likes","comments","shares","saves","profile_visits","link_clicks"]) numeric[key] = Number(row[key] || 0);
      promotionsByDay.get(row.day).push(numeric);
    }
    const days = [];
    for (let offset = 0; offset < dayCount; offset++) {
      const date = new Date(`${startDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      const day = date.toISOString().slice(0, 10);
      const cms = cmsByDay.get(day) || {};
      days.push({
        day,
        articles: articlesByDay.get(day) || [],
        cms_page_views: Number(cms.page_views || 0),
        cms_visitors: Number(cms.visitors || 0),
        platforms: promotionsByDay.get(day) || []
      });
    }
    const platformSummary = platformRows.map(row => {
      const item = { ...row };
      for (const key of ["posts","reach","impressions","likes","comments","shares","saves","profile_visits","link_clicks"]) item[key] = Number(row[key] || 0);
      return item;
    });
    res.json({ start_date: startDate, end_date: endDate, days, platform_summary: platformSummary });
  } catch (error) { next(error); }
});

router.get("/api/marketing/admin/promotions", ...adminOnly, async (req, res, next) => {
  try {
    const campaignId = Number(req.query.campaign_id);
    if (!Number.isInteger(campaignId) || campaignId < 1) return res.status(400).json({ message: "Pilih kampanye terlebih dahulu." });
    const [rows] = await pool.query(
      `SELECT p.*,b.title AS article_title,b.slug AS article_slug
       FROM campaign_promotions p LEFT JOIN blog_posts b ON b.id=p.article_id
       WHERE p.campaign_id=? ORDER BY COALESCE(p.published_at,p.scheduled_at,p.created_at) DESC,p.id DESC`,
      [campaignId]
    );
    res.json(rows);
  } catch (error) { next(error); }
});

router.post("/api/marketing/admin/promotions", ...adminOnly, async (req, res, next) => {
  try {
    const campaignId = Number(req.body.campaign_id);
    const articleId = req.body.article_id ? Number(req.body.article_id) : null;
    const platform = cleanText(req.body.platform,40).toLowerCase();
    const format = cleanText(req.body.content_format,60).toLowerCase();
    const status = req.body.status === "published" ? "published" : "planned";
    const postUrl = cleanText(req.body.post_url,1000);
    if (postUrl && !/^https?:\/\//i.test(postUrl)) return res.status(400).json({ message: "URL publikasi harus menggunakan http:// atau https://." });
    const metrics = ["reach","impressions","likes","comments","shares","saves","profile_visits","link_clicks"].map(k => {
      const n = Number(req.body[k] || 0);
      if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Metrik ${k} harus berupa angka nol atau lebih.`);
      return n;
    });
    if (!Number.isInteger(campaignId) || campaignId < 1 || !allowedPlatforms.has(platform) || !allowedFormats.has(format)) {
      return res.status(400).json({ message: "Kampanye, platform, atau format tidak valid." });
    }
    if (status === "published" && !/^https?:\/\//i.test(postUrl)) return res.status(400).json({ message: "URL publikasi wajib diisi dan harus menggunakan http:// atau https://." });
    const publishedAt = status === "published" ? (req.body.published_at || new Date()) : null;
    const scheduledAt = req.body.scheduled_at || null;
    const params = [campaignId, Number.isInteger(articleId) && articleId > 0 ? articleId : null, platform, format, status, scheduledAt, publishedAt, postUrl || null, ...metrics, cleanText(req.body.caption,5000) || null, cleanText(req.body.hashtags,500) || null, cleanText(req.body.cta,300) || null, cleanText(req.body.notes,3000) || null];
    const [result] = await pool.query(
      `INSERT INTO campaign_promotions
       (campaign_id,article_id,platform,content_format,status,scheduled_at,published_at,post_url,reach,impressions,likes,comments,shares,saves,profile_visits,link_clicks,caption,hashtags,cta,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, params
    );
    res.status(201).json({ id: result.insertId, message: "Promosi dicatat." });
  } catch (error) { next(error); }
});

router.put("/api/marketing/admin/promotions/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const platform = cleanText(req.body.platform,40).toLowerCase();
    const format = cleanText(req.body.content_format,60).toLowerCase();
    const status = req.body.status === "published" ? "published" : "planned";
    const postUrl = cleanText(req.body.post_url,1000);
    if (postUrl && !/^https?:\/\//i.test(postUrl)) return res.status(400).json({ message: "URL publikasi harus menggunakan http:// atau https://." });
    const metrics = ["reach","impressions","likes","comments","shares","saves","profile_visits","link_clicks"].map(k => {
      const n = Number(req.body[k] || 0);
      if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Metrik ${k} harus berupa angka nol atau lebih.`);
      return n;
    });
    if (!Number.isInteger(id) || !allowedPlatforms.has(platform) || !allowedFormats.has(format)) return res.status(400).json({ message: "Data promosi belum valid." });
    if (status === "published" && !/^https?:\/\//i.test(postUrl)) return res.status(400).json({ message: "URL publikasi wajib diisi dan harus menggunakan http:// atau https://." });
    const params = [Number(req.body.article_id) || null, platform, format, status, req.body.scheduled_at || null, status === "published" ? (req.body.published_at || new Date()) : null, postUrl || null, ...metrics, cleanText(req.body.caption,5000) || null, cleanText(req.body.hashtags,500) || null, cleanText(req.body.cta,300) || null, cleanText(req.body.notes,3000) || null, id];
    await pool.query(
      `UPDATE campaign_promotions SET article_id=?,platform=?,content_format=?,status=?,scheduled_at=?,published_at=?,post_url=?,
       reach=?,impressions=?,likes=?,comments=?,shares=?,saves=?,profile_visits=?,link_clicks=?,caption=?,hashtags=?,cta=?,notes=? WHERE id=?`, params
    );
    res.json({ message: "Data promosi diperbarui." });
  } catch (error) { next(error); }
});

router.delete("/api/marketing/admin/promotions/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "ID promosi tidak valid." });
    await pool.query("DELETE FROM campaign_promotions WHERE id=?", [id]);
    res.json({ message: "Promosi dihapus." });
  } catch (error) { next(error); }
});

module.exports = router;
