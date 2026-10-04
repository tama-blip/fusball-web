# Fusball.id 1.0 Final

Versi final untuk fase **brand + storefront + catalog management**. Fokus pembayaran sengaja ditunda.

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
Versi ini **tidak meminta kamu drop/import ulang database**. Saat server start, tabel `site_settings` dibuat otomatis jika belum ada.

Untuk instalasi database baru, gunakan `database/schema.sql`.

## Alur tambah produk
Admin → Produk → Tambah Produk → isi data → pilih kategori → pilih maksimal 2 foto → foto pertama = DEPAN, foto kedua = BELAKANG → Buat Produk.

## Catatan
Pembayaran belum diaktifkan. Checkout masih berfungsi sebagai alur pre-order internal/demo sampai payment gateway resmi ditambahkan.


### V10 Editorial CMS
The package includes a Journal/Blog module based on external links and an editable Web Team section. Existing product photos/assets are retained. See `docs/V10_EDITORIAL_CMS.md`.
