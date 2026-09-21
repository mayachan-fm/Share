STAGE P11 — NOTIFIKASI PREMIUM

Perubahan:
- Menambahkan notifikasi Premium untuk pemberian Premium, perpanjangan, dan pencabutan.
- Notifikasi disimpan di Firebase pada notifikasi/<uid>.
- User hanya dapat membaca notifikasi miliknya sendiri.
- Perubahan notifikasi ditulis melalui Firebase Admin SDK di server.
- Profil menampilkan daftar notifikasi dan jumlah yang belum dibaca.
- User dapat menandai semua notifikasi sebagai sudah dibaca melalui API.
- Premium card lama di profil tidak diubah.

File diubah:
- api/manage-premium.js
- profil.html
- style.css
- firebase-rules-stage-p1.json

File baru:
- api/notifications.js
- notifikasi.js
- README-STAGE-P11.txt

Tidak ada file yang dihapus.

Catatan:
- Setelah deploy, Rules Firebase perlu dipublikasikan dengan node notifikasi.
- Notifikasi yang dibuat sebelum P11 tidak akan muncul otomatis; notifikasi baru dibuat mulai saat P11 aktif.
