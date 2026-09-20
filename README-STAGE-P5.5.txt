MC Addon Share — Stage P5.5
Private Catalog / Hide data.json from Vercel

TUJUAN
- data.json tetap menjadi sumber data di repository GitHub.
- data.json TIDAK ikut dalam deployment Vercel sebagai file statis.
- Website membaca katalog melalui /api/catalog.
- Token GitHub hanya dipakai server-side.

PERUBAHAN
1. Menambahkan api/catalog.js.
2. Frontend tidak lagi fetch ./data.json secara langsung.
3. Menambahkan .vercelignore untuk mengecualikan data.json dari deployment Vercel.
4. Link publik untuk melihat data.json di panel Admin dihilangkan.

PENTING
- GITHUB_TOKEN yang sudah dipakai API add/update/delete harus tetap tersedia di Vercel.
- data.json tetap berada di GitHub karena API add/update/delete masih mengelolanya di sana.
- Setelah deployment, https://DOMAIN/data.json harus menghasilkan 404.
- Endpoint /api/catalog memang dapat diakses website karena browser membutuhkan katalog untuk daftar, pencarian, filter, dan detail. Jadi tahap ini menyembunyikan file mentah data.json dari deployment; tahap ini belum membuat isi katalog menjadi rahasia dari browser.

CARA DEPLOY
1. Masukkan file api/catalog.js ke folder api.
2. Masukkan .vercelignore ke root repository.
3. Pastikan data.json tetap ada di repository GitHub.
4. Commit dan push.
5. Tunggu Vercel selesai deploy.
6. Uji /data.json -> harus 404.
7. Buka halaman utama -> katalog harus tetap tampil.
8. Uji detail addon, pencarian, Admin dan Owner.
