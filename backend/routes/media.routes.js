const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const cloudinary = require("../config/cloudinary");

const {
  authenticate,
  requireRole
} = require("../middleware/auth.middleware");

const {
  productUpload,
  siteUpload,
  SITE_DIR
} = require("../middleware/upload.middleware");

const router = express.Router();


// ============================================================
// HELPER: DELETE IMAGE FROM CLOUDINARY
// ============================================================

async function deleteCloudinaryImage(imageUrl) {
  if (!imageUrl || !imageUrl.includes("res.cloudinary.com")) {
    return;
  }

  try {
    const uploadMarker = "/upload/";
    const uploadIndex = imageUrl.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return;
    }

    let publicId = imageUrl.substring(
      uploadIndex + uploadMarker.length
    );

    // Remove Cloudinary version, example:
    // v1791167976/fusball_id/products/image.jpg
    publicId = publicId.replace(/^v\d+\//, "");

    // Remove file extension
    publicId = publicId.replace(/\.[^/.]+$/, "");

    if (!publicId) {
      return;
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true
    });

    console.log(
      `Cloudinary image deleted: ${publicId}`
    );

  } catch (error) {
    console.error(
      "Failed to delete Cloudinary image:",
      error.message
    );
  }
}


// ============================================================
// SITE HERO IMAGE
// ============================================================

// Get current homepage hero image
router.get("/site/hero", async (_req, res, next) => {
  try {
    const files = fs
      .readdirSync(SITE_DIR)
      .filter(name => /\.(jpe?g|png|webp)$/i.test(name))
      .sort()
      .reverse();

    if (!files.length) {
      return res.json({
        exists: false,
        image_url: null
      });
    }

    res.json({
      exists: true,
      image_url: `/uploads/site/${files[0]}`
    });

  } catch (error) {
    next(error);
  }
});


// Upload homepage hero image
router.post(
  "/site/hero",
  authenticate,
  requireRole("admin"),
  siteUpload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Choose a JPG, PNG, or WEBP image."
        });
      }

      // Remove old hero images
      for (const name of fs.readdirSync(SITE_DIR)) {
        if (
          name !== req.file.filename &&
          /\.(jpe?g|png|webp)$/i.test(name)
        ) {
          const oldPath = path.join(SITE_DIR, name);

          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }

      res.status(201).json({
        message: "Homepage hero image updated.",
        image_url: `/uploads/site/${req.file.filename}`
      });

    } catch (error) {

      if (
        req.file?.path &&
        fs.existsSync(req.file.path)
      ) {
        fs.unlinkSync(req.file.path);
      }

      next(error);
    }
  }
);


// Delete homepage hero image
router.delete(
  "/site/hero",
  authenticate,
  requireRole("admin"),
  async (_req, res, next) => {
    try {

      for (const name of fs.readdirSync(SITE_DIR)) {

        if (/\.(jpe?g|png|webp)$/i.test(name)) {

          const filePath = path.join(
            SITE_DIR,
            name
          );

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      res.json({
        message: "Homepage hero image removed."
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// PRODUCT IMAGES
// ============================================================

// Upload product images
//
// Flow:
// Admin CMS
//    ↓
// Multer temporary file
//    ↓
// Cloudinary
//    ↓
// Cloudinary secure_url
//    ↓
// MySQL product_images
//
router.post(
  "/products/:id/images",
  authenticate,
  requireRole("admin"),
  productUpload.array("images", 8),
  async (req, res, next) => {

    const uploadedCloudinary = [];

    try {

      const productId = Number(req.params.id);

      // --------------------------------------------------------
      // Check product
      // --------------------------------------------------------

      const [products] = await pool.query(
        "SELECT id FROM products WHERE id=? LIMIT 1",
        [productId]
      );

      if (!products.length) {

        // Delete temporary uploaded files
        for (const file of req.files || []) {

          if (
            file.path &&
            fs.existsSync(file.path)
          ) {
            fs.unlinkSync(file.path);
          }
        }

        return res.status(404).json({
          message: "Product not found."
        });
      }


      // --------------------------------------------------------
      // Get current sort order
      // --------------------------------------------------------

      const [lastRows] = await pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) AS max_order
         FROM product_images
         WHERE product_id=?`,
        [productId]
      );

      let sortOrder =
        Number(lastRows[0].max_order) + 1;


      const uploaded = [];


      // --------------------------------------------------------
      // Upload each image
      // --------------------------------------------------------

      for (const file of req.files || []) {

        // Upload temporary file to Cloudinary
        const result =
          await cloudinary.uploader.upload(
            file.path,
            {
              folder: "fusball_id/products",
              resource_type: "image"
            }
          );


        // Remember Cloudinary public ID
        // so it can be deleted if something fails later
        uploadedCloudinary.push(
          result.public_id
        );


        // Delete temporary local file
        if (
          file.path &&
          fs.existsSync(file.path)
        ) {
          fs.unlinkSync(file.path);
        }


        // Permanent Cloudinary URL
        const publicUrl =
          result.secure_url;


        // Save Cloudinary URL to database
        await pool.query(
          `INSERT INTO product_images
           (product_id, image_url, sort_order)
           VALUES (?, ?, ?)`,
          [
            productId,
            publicUrl,
            sortOrder++
          ]
        );


        uploaded.push(publicUrl);
      }


      // --------------------------------------------------------
      // Set first uploaded image as main image
      // --------------------------------------------------------

      if (uploaded.length) {

        const [current] = await pool.query(
          `SELECT image_url
           FROM products
           WHERE id=?
           LIMIT 1`,
          [productId]
        );


        if (
          current.length &&
          !current[0].image_url
        ) {

          await pool.query(
            `UPDATE products
             SET image_url=?
             WHERE id=?`,
            [
              uploaded[0],
              productId
            ]
          );
        }
      }


      // --------------------------------------------------------
      // Response
      // --------------------------------------------------------

      res.status(201).json({
        message:
          `${uploaded.length} image(s) uploaded.`,
        images: uploaded
      });

    } catch (error) {

      // --------------------------------------------------------
      // Delete temporary local files
      // --------------------------------------------------------

      for (const file of req.files || []) {

        if (
          file.path &&
          fs.existsSync(file.path)
        ) {
          fs.unlinkSync(file.path);
        }
      }


      // --------------------------------------------------------
      // Cleanup Cloudinary if database operation failed
      // --------------------------------------------------------

      for (const publicId of uploadedCloudinary) {

        try {

          await cloudinary.uploader.destroy(
            publicId,
            {
              resource_type: "image",
              invalidate: true
            }
          );

        } catch (cleanupError) {

          console.error(
            "Failed to cleanup Cloudinary file:",
            cleanupError.message
          );
        }
      }


      next(error);
    }
  }
);


// ============================================================
// SET PRODUCT IMAGE AS MAIN IMAGE
// ============================================================

router.put(
  "/products/:productId/images/:imageId/main",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {

    try {

      const productId =
        Number(req.params.productId);

      const imageId =
        Number(req.params.imageId);


      const [rows] = await pool.query(
        `SELECT image_url
         FROM product_images
         WHERE id=? AND product_id=?
         LIMIT 1`,
        [
          imageId,
          productId
        ]
      );


      if (!rows.length) {

        return res.status(404).json({
          message: "Image not found."
        });
      }


      // Update main product image
      await pool.query(
        `UPDATE products
         SET image_url=?
         WHERE id=?`,
        [
          rows[0].image_url,
          productId
        ]
      );


      // Move selected image to first position
      await pool.query(
        `UPDATE product_images
         SET sort_order =
           CASE
             WHEN id=? THEN 0
             ELSE sort_order + 1
           END
         WHERE product_id=?`,
        [
          imageId,
          productId
        ]
      );


      res.json({
        message:
          "Main product image updated.",
        image_url:
          rows[0].image_url
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// DELETE PRODUCT IMAGE
// ============================================================

router.delete(
  "/products/:productId/images/:imageId",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {

    try {

      const productId =
        Number(req.params.productId);

      const imageId =
        Number(req.params.imageId);


      // --------------------------------------------------------
      // Find image
      // --------------------------------------------------------

      const [rows] = await pool.query(
        `SELECT image_url
         FROM product_images
         WHERE id=? AND product_id=?
         LIMIT 1`,
        [
          imageId,
          productId
        ]
      );


      if (!rows.length) {

        return res.status(404).json({
          message: "Image not found."
        });
      }


      const imageUrl =
        rows[0].image_url;


      // --------------------------------------------------------
      // Delete database record
      // --------------------------------------------------------

      await pool.query(
        `DELETE FROM product_images
         WHERE id=? AND product_id=?`,
        [
          imageId,
          productId
        ]
      );


      // --------------------------------------------------------
      // Delete physical image
      //
      // New images:
      // Cloudinary
      //
      // Old images:
      // Render/local uploads folder
      // --------------------------------------------------------

      if (imageUrl) {

        if (
          imageUrl.includes(
            "res.cloudinary.com"
          )
        ) {

          // New Cloudinary image
          await deleteCloudinaryImage(
            imageUrl
          );

        } else {

          // Old local image
          const filePath = path.join(
            __dirname,
            "..",
            "..",
            imageUrl.replace(/^\/+/, "")
          );


          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }


      // --------------------------------------------------------
      // Select next image as main image
      // --------------------------------------------------------

      const [main] = await pool.query(
        `SELECT image_url
         FROM product_images
         WHERE product_id=?
         ORDER BY sort_order, id
         LIMIT 1`,
        [productId]
      );


      await pool.query(
        `UPDATE products
         SET image_url=?
         WHERE id=?`,
        [
          main[0]?.image_url || null,
          productId
        ]
      );


      res.json({
        message: "Image deleted."
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;