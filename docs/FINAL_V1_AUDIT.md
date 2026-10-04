# Final V1 Audit

## Perubahan arsitektur
- Site settings dipindahkan dari localStorage ke tabel `site_settings`.
- Admin mendapat CRUD kategori.
- Admin mendapat create/update/delete product.
- Delete product diblokir jika produk sudah dipakai dalam order.
- Product image cleanup dilakukan saat product dihapus.
- Search/filter katalog memakai API database.
- Hero image disimpan di server.
- Gallery mendukung DEPAN + BELAKANG.
- Admin dapat mengganti gambar utama.

## Regression checks
- Backend JS syntax: 0 error.
- Frontend JS syntax: 0 error.
- Inline admin scripts: 0 error.
- Root package.json tersedia di root ZIP.
- No database reset required for existing installation.

## Manual smoke test wajib di mesin pengguna
Customer:
Login → Beranda → Koleksi → Cari → Filter kategori → Filter status → Urutkan → Detail → Gallery → Tas → Checkout → Akun → Logout.

Admin:
Login → Ringkasan → Homepage → Upload hero → Kategori → Tambah kategori → Produk → Tambah produk → Upload DEPAN/BELAKANG → Edit → Set gambar utama → Pesanan → Custom → Logout.
