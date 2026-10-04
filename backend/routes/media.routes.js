const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const { productUpload, siteUpload, SITE_DIR } = require("../middleware/upload.middleware");

const router = express.Router();


// Site-level hero image. Stored on disk so the admin upload survives browser
// refreshes and does not depend on localStorage size limits.
router.get("/site/hero", async (_req, res, next) => {
  try {
    const files = fs.readdirSync(SITE_DIR)
      .filter(name => /\.(jpe?g|png|webp)$/i.test(name))
      .sort()
      .reverse();

    if (!files.length) return res.json({ exists: false, image_url: null });

    res.json({ exists: true, image_url: `/uploads/site/${files[0]}` });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/site/hero",
  authenticate,
  requireRole("admin"),
  siteUpload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Choose a JPG, PNG, or WEBP image." });

      for (const name of fs.readdirSync(SITE_DIR)) {
        if (name !== req.file.filename && /\.(jpe?g|png|webp)$/i.test(name)) {
          const oldPath = path.join(SITE_DIR, name);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      }

      res.status(201).json({
        message: "Homepage hero image updated.",
        image_url: `/uploads/site/${req.file.filename}`
      });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(error);
    }
  }
);

router.delete(
  "/site/hero",
  authenticate,
  requireRole("admin"),
  async (_req, res, next) => {
    try {
      for (const name of fs.readdirSync(SITE_DIR)) {
        if (/\.(jpe?g|png|webp)$/i.test(name)) {
          const filePath = path.join(SITE_DIR, name);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }
      res.json({ message: "Homepage hero image removed." });
    } catch (error) {
      next(error);
    }
  }
);


router.post(
  "/products/:id/images",
  authenticate,
  requireRole("admin"),
  productUpload.array("images", 8),
  async (req, res, next) => {
    try {
      const productId = Number(req.params.id);
      const [products] = await pool.query(
        "SELECT id FROM products WHERE id=? LIMIT 1",
        [productId]
      );

      if (!products.length) {
        for (const file of req.files || []) fs.unlinkSync(file.path);
        return res.status(404).json({ message: "Product not found." });
      }

      const [lastRows] = await pool.query(
        "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM product_images WHERE product_id=?",
        [productId]
      );
      let sortOrder = Number(lastRows[0].max_order) + 1;

      const uploaded = [];
      for (const file of req.files || []) {
        const publicUrl = `/uploads/products/${file.filename}`;
        await pool.query(
          `INSERT INTO product_images(product_id,image_url,sort_order)
           VALUES(?,?,?)`,
          [productId, publicUrl, sortOrder++]
        );
        uploaded.push(publicUrl);
      }

      if (uploaded.length) {
        const [current] = await pool.query(
          "SELECT image_url FROM products WHERE id=? LIMIT 1",
          [productId]
        );
        if (!current[0].image_url) {
          await pool.query(
            "UPDATE products SET image_url=? WHERE id=?",
            [uploaded[0], productId]
          );
        }
      }

      res.status(201).json({
        message: `${uploaded.length} image(s) uploaded.`,
        images: uploaded
      });
    } catch (error) {
      next(error);
    }
  }
);


router.put(
  "/products/:productId/images/:imageId/main",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const productId = Number(req.params.productId);
      const imageId = Number(req.params.imageId);

      const [rows] = await pool.query(
        `SELECT image_url FROM product_images
         WHERE id=? AND product_id=? LIMIT 1`,
        [imageId, productId]
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Image not found." });
      }

      await pool.query(
        `UPDATE products SET image_url=? WHERE id=?`,
        [rows[0].image_url, productId]
      );

      await pool.query(
        `UPDATE product_images
         SET sort_order = CASE
           WHEN id=? THEN 0
           ELSE sort_order + 1
         END
         WHERE product_id=?`,
        [imageId, productId]
      );

      res.json({
        message: "Main product image updated.",
        image_url: rows[0].image_url
      });
    } catch (error) {
      next(error);
    }
  }
);


router.delete(
  "/products/:productId/images/:imageId",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const productId = Number(req.params.productId);
      const imageId = Number(req.params.imageId);

      const [rows] = await pool.query(
        "SELECT image_url FROM product_images WHERE id=? AND product_id=? LIMIT 1",
        [imageId, productId]
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Image not found." });
      }

      const imageUrl = rows[0].image_url;
      await pool.query(
        "DELETE FROM product_images WHERE id=? AND product_id=?",
        [imageId, productId]
      );

      if (imageUrl) {
        const filePath = path.join(
          __dirname,
          "..",
          "..",
          imageUrl.replace(/^\//, "")
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      const [main] = await pool.query(
        "SELECT image_url FROM product_images WHERE product_id=? ORDER BY sort_order,id LIMIT 1",
        [productId]
      );

      await pool.query(
        "UPDATE products SET image_url=? WHERE id=?",
        [main[0]?.image_url || null, productId]
      );

      res.json({ message: "Image deleted." });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
