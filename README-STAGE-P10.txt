STAGE P10 — RIWAYAT PREMIUM

Perubahan:
- api/manage-premium.js menyimpan setiap pemberian Premium, perpanjangan, dan pencabutan ke premium_history/.
- Owner dapat melihat 100 riwayat Premium terbaru dari Panel Owner.
- Riwayat menyimpan target akun, aksi, durasi, waktu, masa berlaku, dan Owner yang melakukan perubahan.
- Pemberian/perpanjangan dan pencabutan memakai update Firebase multi-path agar perubahan Premium dan riwayat tercatat bersama.
- owner.html menampilkan daftar Riwayat Premium + tombol muat ulang.
- style.css menambahkan tampilan kartu riwayat yang responsif.

Keamanan:
- premium_history tidak dibaca langsung oleh browser.
- Firebase Rules yang ada tetap membatasi root read/write; akses riwayat dilakukan melalui Firebase Admin SDK di server dan hanya setelah verifikasi Owner.
- Tidak ada secret/token yang disimpan di frontend.

File berubah:
- api/manage-premium.js
- owner.html
- style.css

File baru:
- README-STAGE-P10.txt

File dihapus: tidak ada.
