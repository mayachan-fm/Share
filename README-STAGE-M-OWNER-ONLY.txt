Stage M — Pembagian Hak Akses Pengelolaan

Perubahan:
- Panel Admin hanya dapat menambahkan dan mengedit addon.
- Riwayat aktivitas dihapus dari Panel Admin dan hanya tersedia di Panel Owner.
- API /api/activity hanya dapat dibaca oleh Owner.
- API /api/delete-addon hanya dapat digunakan oleh Owner.
- Tombol hapus addon di Panel Admin dihilangkan.
- Tombol buang dari daftar sementara saat membuat JSON tetap ada karena itu tidak menghapus addon dari data.json.

File utama yang berubah:
- admin.html
- api/activity.js
- api/delete-addon.js

Jangan mengganti data.json.
