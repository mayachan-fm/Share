STAGE M — DASHBOARD STATISTIK

Perubahan:
- admin.html: dashboard statistik katalog, total download, total like, kategori.
- owner.html: dashboard statistik katalog, total download, total like, jumlah aktivitas terbaru.
- style.css: tampilan kartu statistik dan bar kategori.

Sumber:
- data.json untuk jumlah item dan kategori.
- Firebase Realtime Database untuk jumlah download dan like.
- /api/activity untuk jumlah aktivitas yang tersedia (maksimal 100 log terbaru).

Penting:
- Jangan mengganti data.json dari ZIP ini.
- auth.js dan API yang sudah ada tetap dipertahankan.
