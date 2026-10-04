const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..", "uploads");
const PRODUCT_DIR = path.join(ROOT, "products");
const CUSTOM_DIR = path.join(ROOT, "custom");
const SITE_DIR = path.join(ROOT, "site");
const BLOG_DIR = path.join(ROOT, "blog");
const TEAM_DIR = path.join(ROOT, "team");

for (const dir of [PRODUCT_DIR, CUSTOM_DIR, SITE_DIR, BLOG_DIR, TEAM_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function safeFileName(originalName, mimetype) {
  const mimeExt = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
  const ext = mimeExt[mimetype] || path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext)
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
  return `${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${base}${ext}`;
}

function makeStorage(folder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, folder),
    filename: (_req, file, cb) => cb(null, safeFileName(file.originalname, file.mimetype))
  });
}

function fileFilter(_req, file, cb) {
  if (!allowedMime.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, and WEBP images are supported."));
  }
  cb(null, true);
}

const productUpload = multer({
  storage: makeStorage(PRODUCT_DIR),
  limits: { files: 8, fileSize: 8 * 1024 * 1024 },
  fileFilter
});

const customUpload = multer({
  storage: makeStorage(CUSTOM_DIR),
  limits: { files: 1, fileSize: 10 * 1024 * 1024 },
  fileFilter
});

const siteUpload = multer({
  storage: makeStorage(SITE_DIR),
  limits: { files: 1, fileSize: 12 * 1024 * 1024 },
  fileFilter
});

const editorialUpload = (folder) => multer({
  storage: makeStorage(folder),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter
});

const blogUpload = editorialUpload(BLOG_DIR);
const teamUpload = editorialUpload(TEAM_DIR);

module.exports = {
  productUpload,
  customUpload,
  siteUpload,
  blogUpload,
  teamUpload,
  SITE_DIR,
  BLOG_DIR,
  TEAM_DIR
};
