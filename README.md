# Fusball.id Professional 2.2 — Blog Marketing Campaign

Project storefront dan CMS FusballID yang diperluas dengan Native Blog, SEO, Website Analytics, dan Campaign Tracker. Fokus pembayaran tetap ditunda; checkout masih demo/internal.

## Fitur storefront
- Beranda dengan struktur AIDA: perhatian → ketertarikan → keinginan → aksi.
- Bahasa Indonesia pada UI utama.
- Koleksi dengan pencarian, kategori, status PO, dan pengurutan harga/nama.
- Kartu produk mendukung foto DEPAN + BELAKANG dan hover transition.
- Halaman detail produk dengan gallery dan lightbox.
- Tentang Kami.
- Kontak + tombol Chat.
- Floating Chat yang dapat diarahkan ke WhatsApp dari Admin.
- Custom Team dengan tracking status.
- Akun customer dengan tracking order.
- Animasi reveal, hover, ticker, dan reduced-motion fallback.
- CTA dan visual editorial sportwear.

## Fitur admin
- Ringkasan KPI.
- Editor homepage dan copy brand.
- Upload foto hero sebagai file asli.
- CRUD kategori.
- Tambah, edit, dan hapus produk.
- Edit harga, slug, kategori, status PO, featured, estimasi produksi, ukuran, dan cerita produk.
- Upload foto DEPAN + BELAKANG.
- Set foto utama dan hapus foto.
- Pencarian + filter produk di admin.
- Kelola status pesanan.
- Kelola status custom team.
- Pengaturan WhatsApp, email, Instagram.

## Instalasi
1. Extract ZIP ini ke folder baru.
2. Buka **folder yang langsung berisi `package.json`** di VS Code. ZIP ini sengaja dibuat tanpa folder bersarang agar masalah `ENOENT package.json` tidak terulang.
3. Salin `.env` dari project lama ke folder ini. Jangan membuat kredensial database baru jika database lama masih digunakan.
4. Jika ingin mempertahankan foto yang sudah diupload pada project lama, salin folder `uploads` lama ke folder project ini dengan nama yang sama.
5. Jalankan:

```powershell
npm.cmd install
npm.cmd start
```

6. Buka `http://localhost:3000`.
7. Cek `http://localhost:3000/api/health`.

## Database
Versi ini **tidak meminta kamu drop/import ulang database**. Startup server tidak menjalankan migrasi atau DDL database; perubahan skema Blog Marketing dijalankan manual melalui skrip migrasi setelah backup.

Untuk instalasi database baru, gunakan `database/schema.sql`. Untuk database existing, ikuti `DEPLOY_CHECKLIST.md`.

## Alur tambah produk
Admin → Produk → Tambah Produk → isi data → pilih kategori → pilih maksimal 2 foto → foto pertama = DEPAN, foto kedua = BELAKANG → Buat Produk.

## Catatan
Pembayaran belum diaktifkan. Checkout masih berfungsi sebagai alur pre-order internal/demo sampai payment gateway resmi ditambahkan.


### V10 Editorial CMS
The package includes a Journal/Blog module based on external links and an editable Web Team section. Existing product photos/assets are retained. See `docs/V10_EDITORIAL_CMS.md`.


## Blog Marketing Campaign — Native Blog CMS

Versi ini menambahkan Blog Studio, SEO metadata, analytics website, dan Campaign Tracker tanpa menghapus Journal Links eksternal yang sudah ada.

### Fitur baru
- Native blog: judul, slug, excerpt, isi Markdown, thumbnail, kategori, tag, penulis, draft, scheduled, dan published.
- SEO: SEO title, meta description, focus keyword, keyword pendukung, canonical URL, Open Graph, Article JSON-LD, dan sitemap.xml.
- Website analytics: page views, unique visitors berbasis ID acak pihak pertama, views per artikel, traffic source sederhana, serta tren harian. IP address dan user-agent tidak disimpan.
- Campaign Tracker: kalender/rencana publikasi, catatan link post, platform, format, reach, views, likes, comments, shares, saves, profile visits, link clicks, ERR, dan CTR. Data media sosial dicatat manual dari Insights resmi.
- Artikel terjadwal terlihat otomatis ketika halaman diminta setelah waktu jadwal tiba; tidak membutuhkan cron/background worker.

### Upgrade database existing (wajib sekali)
1. **Backup database terlebih dahulu.** Untuk Clever Cloud, pastikan `.env.cloud` di folder project berisi DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME yang terbaru, lalu jalankan `npm run backup:cloud`. Script memakai `mysql2` sehingga tidak bergantung pada `mysqldump`/client MariaDB XAMPP. Simpan file SQL backup di lokasi aman.
2. Jalankan migrasi Clever Cloud dari folder project: `npm run migrate:marketing:cloud`. Untuk database lokal gunakan `npm run migrate:marketing` (membaca `.env`).
3. Pastikan output `MIGRASI BLOG MARKETING BERHASIL`. Migrasi idempotent: kolom/tabel yang sudah ada tidak dibuat ulang.
4. Setelah migrasi berhasil, baru commit/push kode dan deploy ke Render. Urutan ini penting karena route baru membaca kolom blog marketing.
5. Setelah Render berstatus Live, cek `/api/health`, `/blog.html`, lalu login Admin → Blog Studio.

Migrasi **tidak dijalankan saat server startup**. Ini disengaja supaya startup Render tidak menambah perebutan koneksi MySQL. Jalankan hanya sekali secara manual setelah backup.

### Analytics
Tracking analytics baru berjalan setelah pengunjung memilih “Izinkan” pada pemberitahuan statistik. Jika ditolak, fungsi website tetap berjalan dan kunjungan tidak dicatat. Visitor memakai UUID acak pada localStorage; server menyimpan SHA-256 hash ID tersebut, tanpa menyimpan IP address atau user-agent. Pengunjung yang menghapus storage atau memakai browser/perangkat berbeda dapat dihitung sebagai visitor berbeda. Traffic source disimpulkan dari UTM/referrer dan tidak selalu tersedia. Data historis sebelum tracking aktif tidak dapat direkonstruksi.

### Campaign Tracker
Data reach, impressions, engagement, profile visits, dan link clicks dimasukkan manual dari Instagram Insights/TikTok Analytics. Reach lintas platform tidak boleh dijumlahkan sebagai orang unik. ERR = (likes + comments + shares + saves) / reach × 100%. CTR = link clicks / impressions × 100%.

### Environment variables dan keamanan
Salin `.env.example` menjadi `.env` secara lokal dan isi kredensial milikmu. Untuk migrasi/backup Clever Cloud, simpan konfigurasi terpisah pada `.env.cloud` dengan key `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, dan `DB_NAME`. Jangan commit `.env`, `.env.cloud`, backup environment, atau dump database. `PUBLIC_BASE_URL` opsional untuk URL pada `sitemap.xml`.

**Penting:** jika arsip project lama pernah dibagikan dan berisi `.env`/`.env.cloud`, rotasi DB password Clever Cloud, Cloudinary API key/secret, dan JWT secret. Perbarui nilai baru di Render Environment dan file lokal. Rotasi JWT secret akan membuat sesi login lama harus login ulang.


### Backup manual
- Lokal: `npm run backup:database` (membaca `.env`).
- Clever Cloud: `npm run backup:cloud` (membaca `.env.cloud`).
- File backup dibuat di folder project dengan nama bertimestamp. File tersebut masuk aturan `.gitignore`; simpan di media privat dan jangan commit ke GitHub.
