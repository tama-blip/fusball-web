const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const authRoutes = require("./routes/auth.routes");
const { authenticate, requireRole } = require("./middleware/auth.middleware");
const { blogUpload, teamUpload } = require("./middleware/upload.middleware");
const orderRoutes = require("./routes/order.routes");
const customRoutes = require("./routes/custom.routes");
const mediaRoutes = require("./routes/media.routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

const asyncRoute = handler => (req,res,next) =>
  Promise.resolve(handler(req,res,next)).catch(next);

const ensureCmsTables = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  const defaults = {
    hero_kicker: "KOLEKSI FANTASY FOOTBALL",
    hero_title: "Kenakan jersey yang punya cerita.",
    hero_description: "Jersey fantasy original Fusball.id untuk kamu yang melihat sepak bola sebagai budaya, identitas, dan cara berekspresi.",
    about_title: "Bukan sekadar jersey.",
    about_description: "Fusball.id lahir dari kecintaan pada football culture. Kami membuat jersey fantasy dan custom yang membawa cerita, karakter, dan identitas ke luar lapangan.",
    whatsapp: "",
    email: "",
    instagram: "https://www.instagram.com/fusball.id/"
  };
  for (const [key,value] of Object.entries(defaults)) {
    await pool.query("INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES (?,?)", [key,value]);
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS blog_posts (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(180) NOT NULL, excerpt TEXT NULL, url VARCHAR(1000) NOT NULL,
    image_url VARCHAR(1000) NULL, published TINYINT(1) NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS web_team (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, role VARCHAR(160) NOT NULL, bio TEXT NULL,
    photo_url VARCHAR(1000) NULL, instagram_url VARCHAR(1000) NULL, sort_order INT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
};


app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/custom-requests", customRoutes);
app.use("/api/media", mediaRoutes);

app.get("/api/site-settings", asyncRoute(async (_req,res) => {
  const [rows]=await pool.query("SELECT setting_key,setting_value FROM site_settings");
  const data={}; for(const row of rows) data[row.setting_key]=row.setting_value;
  res.json(data);
}));

app.get("/api/blog", asyncRoute(async (_req,res) => {
  const [rows] = await pool.query(`SELECT id,title,excerpt,url,image_url,published,sort_order,created_at,updated_at FROM blog_posts WHERE published=1 ORDER BY sort_order ASC, created_at DESC`);
  res.json(rows);
}));

app.get("/api/team", asyncRoute(async (_req,res) => {
  const [rows] = await pool.query(`SELECT id,name,role,bio,photo_url,instagram_url,sort_order FROM web_team WHERE active=1 ORDER BY sort_order ASC, id ASC`);
  res.json(rows);
}));

const isLocalUpload = (value, folder) => typeof value === "string" && value.startsWith(`/uploads/${folder}/`);
const deleteLocalUpload = (value) => {
  if (!value || !value.startsWith("/uploads/")) return;
  const relative = value.replace(/^\//, "");
  const root = path.resolve(path.join(__dirname, "..", "uploads"));
  const filePath = path.resolve(path.join(__dirname, "..", relative));
  if (!filePath.startsWith(root + path.sep)) return;
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (error) { console.error("[Fusball.id] Failed to delete uploaded file:", error.message); }
};

app.get("/api/admin/blog", authenticate, requireRole("admin"), asyncRoute(async (_req,res) => {
  const [rows] = await pool.query(`SELECT * FROM blog_posts ORDER BY sort_order ASC, created_at DESC`);
  res.json(rows);
}));

app.post("/api/admin/blog", authenticate, requireRole("admin"), blogUpload.single("thumbnail"), asyncRoute(async (req,res) => {
  const title = String(req.body.title || "").trim();
  const url = String(req.body.url || "").trim();
  if (!title || !url) return res.status(400).json({message:"Judul dan link blog wajib diisi."});
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({message:"Link blog harus diawali http:// atau https://."});
  const imageUrl = req.file ? `/uploads/blog/${req.file.filename}` : null;
  const published = String(req.body.published) === "false" || String(req.body.published) === "0" ? 0 : 1;
  const sortOrder = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    const [r] = await pool.query(
      `INSERT INTO blog_posts(title,excerpt,url,image_url,published,sort_order) VALUES (?,?,?,?,?,?)`,
      [title, String(req.body.excerpt || "").trim(), url, imageUrl, published, sortOrder]
    );
    res.status(201).json({id:r.insertId,message:"Blog ditambahkan."});
  } catch (error) {
    if (req.file) deleteLocalUpload(imageUrl);
    throw error;
  }
}));

app.put("/api/admin/blog/:id", authenticate, requireRole("admin"), blogUpload.single("thumbnail"), asyncRoute(async (req,res) => {
  const id = Number(req.params.id);
  const title = String(req.body.title || "").trim();
  const url = String(req.body.url || "").trim();
  if (!Number.isInteger(id) || !title || !/^https?:\/\//i.test(url)) {
    if (req.file) deleteLocalUpload(`/uploads/blog/${req.file.filename}`);
    return res.status(400).json({message:"Data blog belum valid."});
  }
  const [existingRows] = await pool.query("SELECT image_url FROM blog_posts WHERE id=? LIMIT 1", [id]);
  if (!existingRows.length) {
    if (req.file) deleteLocalUpload(`/uploads/blog/${req.file.filename}`);
    return res.status(404).json({message:"Blog tidak ditemukan."});
  }
  const oldImage = existingRows[0].image_url || null;
  const newImage = req.file ? `/uploads/blog/${req.file.filename}` : oldImage;
  const published = String(req.body.published) === "true" || String(req.body.published) === "1" ? 1 : 0;
  const sortOrder = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    await pool.query(
      `UPDATE blog_posts SET title=?,excerpt=?,url=?,image_url=?,published=?,sort_order=? WHERE id=?`,
      [title, String(req.body.excerpt || "").trim(), url, newImage, published, sortOrder, id]
    );
    if (req.file && isLocalUpload(oldImage, "blog") && oldImage !== newImage) deleteLocalUpload(oldImage);
    res.json({message:"Blog diperbarui.", image_url:newImage});
  } catch (error) {
    if (req.file) deleteLocalUpload(newImage);
    throw error;
  }
}));

app.delete("/api/admin/blog/:id", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({message:"ID blog tidak valid."});
  const [rows] = await pool.query("SELECT image_url FROM blog_posts WHERE id=? LIMIT 1", [id]);
  if (!rows.length) return res.status(404).json({message:"Blog tidak ditemukan."});
  await pool.query("DELETE FROM blog_posts WHERE id=?", [id]);
  if (isLocalUpload(rows[0].image_url, "blog")) deleteLocalUpload(rows[0].image_url);
  res.json({message:"Blog dihapus."});
}));

app.get("/api/admin/team", authenticate, requireRole("admin"), asyncRoute(async (_req,res) => {
  const [rows] = await pool.query("SELECT * FROM web_team ORDER BY sort_order ASC,id ASC");
  res.json(rows);
}));

app.post("/api/admin/team", authenticate, requireRole("admin"), teamUpload.single("photo"), asyncRoute(async (req,res) => {
  const name = String(req.body.name || "").trim();
  const role = String(req.body.role || "").trim();
  if (!name || !role) {
    if (req.file) deleteLocalUpload(`/uploads/team/${req.file.filename}`);
    return res.status(400).json({message:"Nama dan peran wajib diisi."});
  }
  const photoUrl = req.file ? `/uploads/team/${req.file.filename}` : null;
  const active = String(req.body.active) === "false" || String(req.body.active) === "0" ? 0 : 1;
  const sortOrder = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    const [r] = await pool.query(
      `INSERT INTO web_team(name,role,bio,photo_url,instagram_url,sort_order,active) VALUES (?,?,?,?,?,?,?)`,
      [name, role, String(req.body.bio || "").trim(), photoUrl, String(req.body.instagram_url || "").trim() || null, sortOrder, active]
    );
    res.status(201).json({id:r.insertId,message:"Anggota tim ditambahkan."});
  } catch (error) {
    if (req.file) deleteLocalUpload(photoUrl);
    throw error;
  }
}));

app.put("/api/admin/team/:id", authenticate, requireRole("admin"), teamUpload.single("photo"), asyncRoute(async (req,res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || "").trim();
  const role = String(req.body.role || "").trim();
  if (!Number.isInteger(id) || !name || !role) {
    if (req.file) deleteLocalUpload(`/uploads/team/${req.file.filename}`);
    return res.status(400).json({message:"Data tim belum valid."});
  }
  const [existingRows] = await pool.query("SELECT photo_url FROM web_team WHERE id=? LIMIT 1", [id]);
  if (!existingRows.length) {
    if (req.file) deleteLocalUpload(`/uploads/team/${req.file.filename}`);
    return res.status(404).json({message:"Anggota tim tidak ditemukan."});
  }
  const oldPhoto = existingRows[0].photo_url || null;
  const newPhoto = req.file ? `/uploads/team/${req.file.filename}` : oldPhoto;
  const active = String(req.body.active) === "true" || String(req.body.active) === "1" ? 1 : 0;
  const sortOrder = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    await pool.query(
      `UPDATE web_team SET name=?,role=?,bio=?,photo_url=?,instagram_url=?,sort_order=?,active=? WHERE id=?`,
      [name, role, String(req.body.bio || "").trim(), newPhoto, String(req.body.instagram_url || "").trim() || null, sortOrder, active, id]
    );
    if (req.file && isLocalUpload(oldPhoto, "team") && oldPhoto !== newPhoto) deleteLocalUpload(oldPhoto);
    res.json({message:"Anggota tim diperbarui.", photo_url:newPhoto});
  } catch (error) {
    if (req.file) deleteLocalUpload(newPhoto);
    throw error;
  }
}));

app.delete("/api/admin/team/:id", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({message:"ID anggota tim tidak valid."});
  const [rows] = await pool.query("SELECT photo_url FROM web_team WHERE id=? LIMIT 1", [id]);
  if (!rows.length) return res.status(404).json({message:"Anggota tim tidak ditemukan."});
  await pool.query("DELETE FROM web_team WHERE id=?", [id]);
  if (isLocalUpload(rows[0].photo_url, "team")) deleteLocalUpload(rows[0].photo_url);
  res.json({message:"Anggota tim dihapus."});
}));

app.put("/api/admin/site-settings", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const allowed=["hero_kicker","hero_title","hero_description","about_title","about_description","whatsapp","email","instagram"];
  for(const key of allowed){ if(req.body[key]!==undefined){ await pool.query(`INSERT INTO site_settings(setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,[key,String(req.body[key]??"").trim()]); } }
  res.json({message:"Pengaturan situs disimpan."});
}));

app.get("/api/health", asyncRoute(async (_req,res) => {
  const [rows] = await pool.query("SELECT 1 AS ok");
  res.json({ ok: rows[0].ok === 1, service:"fusball-id", database:"connected" });
}));

app.get("/api/categories", asyncRoute(async (_req,res) => {
  const [rows] = await pool.query(
    "SELECT id, name FROM categories ORDER BY name ASC"
  );
  res.json(rows);
}));

app.get("/api/products", asyncRoute(async (req,res) => {
  const { search = "", category = "all", featured = "" } = req.query;
  const params = [];
  const clauses = ["1=1"];

  if (search) {
    clauses.push("(p.name LIKE ? OR p.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category !== "all") {
    clauses.push("c.name = ?");
    params.push(category);
  }

  if (featured === "1") clauses.push("p.featured = 1");

  const [products] = await pool.query(
    `SELECT p.id,p.name,p.slug,p.description,p.price,p.status,
            p.po_deadline,p.production_estimate,p.featured,p.image_url,
            c.name AS category
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY p.featured DESC, p.created_at DESC`,
    params
  );

  if (!products.length) return res.json([]);

  const ids = products.map(p => p.id);
  const placeholders = ids.map(() => "?").join(",");

  const [sizes] = await pool.query(
    `SELECT product_id,size_code,sort_order
     FROM product_sizes
     WHERE product_id IN (${placeholders})
     ORDER BY sort_order`,
    ids
  );

  const [images] = await pool.query(
    `SELECT product_id,id,image_url,sort_order
     FROM product_images
     WHERE product_id IN (${placeholders})
     ORDER BY sort_order,id`,
    ids
  );

  const sizesMap = {};
  const imagesMap = {};
  for (const row of sizes) {
    (sizesMap[row.product_id] ||= []).push(row.size_code);
  }
  for (const row of images) {
    (imagesMap[row.product_id] ||= []).push({
      id: row.id,
      image_url: row.image_url,
      sort_order: row.sort_order
    });
  }

  res.json(products.map(p => ({
    ...p,
    sizes: sizesMap[p.id] || [],
    gallery: imagesMap[p.id] || (p.image_url ? [{ image_url: p.image_url, sort_order: 0 }] : [])
  })));
}));

app.get("/api/products/:id", asyncRoute(async (req,res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message:"Invalid product id." });

  const [rows] = await pool.query(
    `SELECT p.id,p.name,p.slug,p.description,p.price,p.status,
            p.po_deadline,p.production_estimate,p.featured,p.image_url,
            c.name AS category
     FROM products p
     JOIN categories c ON c.id=p.category_id
     WHERE p.id=? LIMIT 1`,
    [id]
  );

  if (!rows.length) return res.status(404).json({ message:"Product not found." });

  const [sizes] = await pool.query(
    `SELECT size_code FROM product_sizes
     WHERE product_id=? ORDER BY sort_order`,
    [id]
  );

  const [images] = await pool.query(
    `SELECT id,image_url,sort_order FROM product_images
     WHERE product_id=? ORDER BY sort_order,id`,
    [id]
  );

  res.json({
    ...rows[0],
    sizes: sizes.map(x => x.size_code),
    gallery: images
  });
}));

app.get("/api/admin/categories", authenticate, requireRole("admin"), asyncRoute(async (_req,res) => {
  const [rows] = await pool.query(`SELECT c.id,c.name,c.created_at,COUNT(p.id) AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id=c.id
    GROUP BY c.id ORDER BY c.name ASC`);
  res.json(rows);
}));

app.post("/api/admin/categories", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const name=String(req.body.name||"").trim();
  if(!name) return res.status(400).json({message:"Nama kategori wajib diisi."});
  if(name.length>100) return res.status(400).json({message:"Nama kategori terlalu panjang."});
  try {
    const [result]=await pool.query("INSERT INTO categories(name) VALUES (?)",[name]);
    res.status(201).json({id:result.insertId,name,message:"Kategori dibuat."});
  } catch(error) {
    if(error.code === "ER_DUP_ENTRY") return res.status(409).json({message:"Kategori sudah ada."});
    throw error;
  }
}));

app.put("/api/admin/categories/:id", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const id=Number(req.params.id); const name=String(req.body.name||"").trim();
  if(!Number.isInteger(id)||!name) return res.status(400).json({message:"ID dan nama kategori wajib diisi."});
  try {
    const [result]=await pool.query("UPDATE categories SET name=? WHERE id=?",[name,id]);
    if(!result.affectedRows) return res.status(404).json({message:"Kategori tidak ditemukan."});
    res.json({message:"Kategori diperbarui."});
  } catch(error) {
    if(error.code === "ER_DUP_ENTRY") return res.status(409).json({message:"Nama kategori sudah digunakan."});
    throw error;
  }
}));

app.delete("/api/admin/categories/:id", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const id=Number(req.params.id);
  const [count]=await pool.query("SELECT COUNT(*) AS total FROM products WHERE category_id=?",[id]);
  if(Number(count[0].total)>0) return res.status(409).json({message:"Kategori masih dipakai produk. Pindahkan produk terlebih dahulu."});
  const [result]=await pool.query("DELETE FROM categories WHERE id=?",[id]);
  if(!result.affectedRows) return res.status(404).json({message:"Kategori tidak ditemukan."});
  res.json({message:"Kategori dihapus."});
}));

app.get("/api/admin/products", authenticate, requireRole("admin"), asyncRoute(async (_req,res) => {
  const [rows] = await pool.query(
    `SELECT p.id,p.name,p.slug,p.price,p.status,p.featured,p.image_url,
            c.name AS category,p.updated_at
     FROM products p
     JOIN categories c ON c.id=p.category_id
     ORDER BY p.updated_at DESC`
  );
  res.json(rows);
}));

app.post("/api/admin/products", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const { categoryId, name, description = "", price, status = "coming_soon", productionEstimate = "", featured = 0, imageUrl = null } = req.body;
  const nameValue=String(name||"").trim();
  const slugValue=String(req.body.slug||"").trim() || nameValue.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,180);
  const numericCategory=Number(categoryId), numericPrice=Number(price);
  const allowedStatus=new Set(["po_open","coming_soon","po_closed"]);
  if(!Number.isInteger(numericCategory)||!nameValue||!slugValue||!Number.isFinite(numericPrice)||numericPrice<0||!allowedStatus.has(String(status))) return res.status(400).json({message:"Data produk belum valid."});
  const [categoryRows]=await pool.query("SELECT id FROM categories WHERE id=? LIMIT 1",[numericCategory]);
  if(!categoryRows.length) return res.status(400).json({message:"Kategori tidak ditemukan."});
  const [slugRows]=await pool.query("SELECT id FROM products WHERE slug=? LIMIT 1",[slugValue]);
  if(slugRows.length) return res.status(409).json({message:"Slug produk sudah digunakan."});

  const [result] = await pool.query(
    `INSERT INTO products
      (category_id,name,slug,description,price,status,production_estimate,featured,image_url)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [numericCategory,nameValue,slugValue,String(description||"").trim(),numericPrice,status,String(productionEstimate||"").trim(),featured ? 1 : 0,imageUrl]
  );

  const sizes = Array.isArray(req.body.sizes) && req.body.sizes.length ? req.body.sizes : ["S","M","L","XL","XXL"];
  for (let i=0;i<sizes.length;i++) await pool.query(`INSERT IGNORE INTO product_sizes(product_id,size_code,sort_order) VALUES (?,?,?)`,[result.insertId,String(sizes[i]).trim(),i+1]);
  res.status(201).json({ id: result.insertId, message:"Product created." });
}));
app.put("/api/admin/products/:id", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const id = Number(req.params.id);
  const allowed = ["name","slug","description","price","status","po_deadline",
    "production_estimate","featured","image_url","category_id"];

  const updates = [];
  const params = [];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates.push(`${field}=?`);
      params.push(req.body[field]);
    }
  }

  if (!updates.length) return res.status(400).json({ message:"Tidak ada perubahan yang dikirim." });
  if(req.body.status!==undefined && !["po_open","coming_soon","po_closed"].includes(String(req.body.status))) return res.status(400).json({message:"Status produk tidak valid."});
  if(req.body.category_id!==undefined){ const [cat]=await pool.query("SELECT id FROM categories WHERE id=? LIMIT 1",[Number(req.body.category_id)]); if(!cat.length) return res.status(400).json({message:"Kategori tidak ditemukan."}); }
  if(req.body.slug!==undefined){ const [slug]=await pool.query("SELECT id FROM products WHERE slug=? AND id<>? LIMIT 1",[String(req.body.slug).trim(),id]); if(slug.length) return res.status(409).json({message:"Slug produk sudah digunakan."}); }

  params.push(id);
  const [result] = await pool.query(
    `UPDATE products SET ${updates.join(", ")} WHERE id=?`,
    params
  );

  if (!result.affectedRows) return res.status(404).json({ message:"Product not found." });

  if (Array.isArray(req.body.sizes)) {
    await pool.query("DELETE FROM product_sizes WHERE product_id=?", [id]);
    for (let i=0;i<req.body.sizes.length;i++) {
      await pool.query(
        `INSERT INTO product_sizes(product_id,size_code,sort_order)
         VALUES (?,?,?)`,
        [id, req.body.sizes[i], i+1]
      );
    }
  }

  res.json({ message:"Product updated." });
}));

app.delete("/api/admin/products/:id", authenticate, requireRole("admin"), asyncRoute(async (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({message:"ID produk tidak valid."});
  const [rows]=await pool.query("SELECT id FROM products WHERE id=? LIMIT 1",[id]);
  if(!rows.length) return res.status(404).json({message:"Produk tidak ditemukan."});
  const [orders]=await pool.query("SELECT COUNT(*) AS total FROM order_items WHERE product_id=?",[id]);
  if(Number(orders[0].total)>0) return res.status(409).json({message:"Produk sudah dipakai dalam pesanan. Gunakan status PO Ditutup daripada menghapusnya."});
  const [images]=await pool.query("SELECT image_url FROM product_images WHERE product_id=?",[id]);
  await pool.query("DELETE FROM products WHERE id=?",[id]);
  for(const row of images){ if(row.image_url){const fp=path.join(__dirname,"..",row.image_url.replace(/^\//,"")); if(fs.existsSync(fp)) fs.unlinkSync(fp);} }
  res.json({message:"Produk dihapus."});
}));

app.get("/api/admin/custom-requests", authenticate, requireRole("admin"), asyncRoute(async (_req,res) => {
  const [rows] = await pool.query(
    `SELECT id,team_name,contact_name,whatsapp,team_size,brief,status,created_at,updated_at
     FROM custom_requests
     ORDER BY created_at DESC`
  );
  res.json(rows);
}));

app.use((err,_req,res,_next) => {
  console.error(err);
  if (err && err.code === "LIMIT_FILE_SIZE") return res.status(400).json({message:"Ukuran gambar terlalu besar. Maksimal 5 MB untuk thumbnail blog dan foto tim."});
  if (err && err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({message:"Field upload tidak dikenali."});
  if (err && err.message === "Only JPG, PNG, and WEBP images are supported.") return res.status(400).json({message:err.message});
  res.status(500).json({
    message:"Internal server error.",
    detail: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

(async () => {
  try {
    await ensureCmsTables();
    app.listen(PORT, () => {
      console.log(`[Fusball.id] Server listening on http://localhost:${PORT}`);
      console.log(`[Fusball.id] Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("[Fusball.id] Startup failed:", error.message);
    process.exit(1);
  }
})();
