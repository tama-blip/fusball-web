# V11 Editorial Upload CMS

## Perubahan
- Thumbnail Journal/Blog sekarang menggunakan upload file, bukan URL gambar.
- Foto anggota Web Team sekarang menggunakan upload file, bukan URL gambar.
- Link artikel eksternal tetap berupa URL karena memang merupakan tujuan artikel.
- JPG, PNG, dan WEBP diterima.
- Ukuran maksimal thumbnail/foto tim: 5 MB.
- Nama file server dibuat aman dan unik berdasarkan MIME type.
- Preview gambar tersedia sebelum disimpan.
- Saat edit, mengosongkan file mempertahankan gambar lama.
- Saat mengganti gambar, file lokal lama dihapus setelah database berhasil diperbarui.
- Saat menghapus artikel/anggota tim, file upload lokal ikut dibersihkan.
- File gambar lama/legacy yang masih berupa URL eksternal tetap dipertahankan dan tetap dapat ditampilkan.
- Aset produk, logo, hero, dan data proyek sebelumnya tidak dihapus.

## Struktur upload
- `uploads/blog/` untuk thumbnail artikel.
- `uploads/team/` untuk foto anggota tim.

## Validasi
- Backend memvalidasi MIME type, bukan hanya ekstensi.
- Backend membatasi ukuran file 5 MB untuk dua jenis upload editorial.
- Endpoint upload hanya dapat digunakan admin yang telah terautentikasi.
