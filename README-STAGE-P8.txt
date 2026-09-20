STAGE P8 — BYPASS PREMIUM / ADMIN / OWNER

Perubahan:
- Menambahkan download-access.js sebagai pemeriksaan akses Download terpusat.
- Premium aktif dapat melewati Download Gate.
- Admin dapat melewati Download Gate.
- Owner dapat melewati Download Gate.
- Guest/User biasa tetap menggunakan Download Gate.
- Jika pemeriksaan akses gagal, sistem fail-safe dan tetap menampilkan Gate.

Catatan:
- P8 masih merupakan pemeriksaan sisi browser.
- Proteksi agar timer/link tidak dapat dilewati dengan memanipulasi browser akan dikerjakan pada P9.
- P8 tidak mengubah data.json, Firebase Rules, atau link download eksternal.
