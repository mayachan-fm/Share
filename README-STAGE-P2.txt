STAGE P2 — OWNER MENGELOLA PREMIUM
MC Addon Share

Ditambahkan:
- API server-side /api/manage-premium.js.
- Owner dapat memberikan Premium 7 hari, 30 hari, 90 hari, atau Permanen.
- Owner dapat melihat daftar akun Premium.
- Owner dapat mencabut Premium.
- Admin tidak dapat memakai API Premium.
- Pemberian dan pencabutan dicatat ke aktivitas Owner.
- Data Premium tidak dihapus ketika dicabut; field dicabutPada menandai pencabutan.
- premium.js sekarang menganggap Premium yang dicabut sebagai tidak aktif.
- UI Kelola Premium ditambahkan ke owner.html.
- CSS UI Premium ditambahkan ke style.css.

Belum pada P2:
- Perpanjangan yang menambah sisa waktu (P4).
- Tampilan Premium di Profil (P5).
- Download Gate/timer/artikel (P6-P9).
- Riwayat Premium terpisah (P10).

Pengujian:
1. Deploy perubahan ke Vercel.
2. Login sebagai Owner.
3. Buka Panel Owner.
4. Berikan Premium ke akun User dengan 7 hari.
5. Pastikan akun muncul sebagai Aktif.
6. Cabut Premium dan pastikan status berubah menjadi Dicabut.
7. Coba akses endpoint dengan akun Admin/User; harus ditolak.
