MC ADDON SHARE — STAGE K
Riwayat Aktivitas Admin / Owner

- Audit log server-side di Firebase pada node aktivitas.
- Log tambah/edit/hapus addon.
- Log tambah/cabut Admin.
- Admin melihat aktivitas addon; Owner melihat semua aktivitas.
- Log dibuat setelah operasi utama berhasil.
- Pembacaan aktivitas melalui api/activity.js yang memeriksa role.

File baru: api/activity.js, lib/activity.js
File diperbarui: api/add-addon.js, api/update-addon.js, api/delete-addon.js, api/manage-role.js, admin.html, owner.html, style.css

Pertahankan data.json yang sedang ada. Commit semua file Stage K ke branch main lalu tunggu Vercel deploy. Tidak perlu mengubah Firebase Rules untuk aktivitas.
