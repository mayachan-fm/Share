STAGE P9 — SECURITY DOWNLOAD GATE
MC Addon Share

Tujuan:
- Membuat Download Gate diverifikasi oleh server, bukan hanya timer JavaScript.
- Menyembunyikan link download dari katalog publik /api/catalog.
- Memberikan akses Premium/Admin/Owner berdasarkan pemeriksaan server.
- Menghitung download di server setelah gate berhasil.

PERUBAHAN FILE:

BARU:
- api/download-gate.js
  Membuat sesi Download Gate di Firebase. User biasa mendapat waktu tunggu acak 10–20 detik. Premium/Admin/Owner mendapat sesi bypass.
- api/download-file.js
  Memvalidasi sesi secara server-side, memastikan token belum dipakai, memeriksa waktu siap, mengecek ulang akses istimewa, menaikkan counter download, lalu redirect ke link file eksternal.

DIUBAH:
- api/catalog.js
  Public catalog tidak lagi mengirim field "link download". Panel Admin/Owner dapat menggunakan ?mode=manage dengan Firebase ID token untuk membaca data lengkap.
- detail.js
  Tidak lagi menerima link download langsung dari katalog publik. Download dimulai melalui sesi server, timer memakai waitSeconds dari server, dan tombol Lanjut Download mengirim token sesi ke /api/download-file.
- admin.html
  Pembacaan katalog pengelolaan menggunakan mode=manage dan Authorization Firebase.
- owner.html
  Pembacaan katalog pengelolaan menggunakan mode=manage dan Authorization Firebase.

TIDAK DIUBAH PADA TAHAP INI:
- data.json tetap berada di GitHub dan tetap dipakai oleh API server.
- Firebase Rules tidak perlu ditambah untuk download_gates karena endpoint menggunakan Firebase Admin SDK.
- Sistem Premium, artikel, komentar, upload/edit/hapus tetap dipertahankan.

CATATAN KEAMANAN:
- Timer di browser bukan lagi sumber kebenaran. Server menyimpan readyAt dan menolak penyelesaian terlalu cepat.
- Token sesi hanya dapat digunakan satu kali dan memiliki masa berlaku pendek.
- Link download tidak dikirim melalui /api/catalog publik.
- Repository GitHub yang PUBLIC tetap dapat mengekspos data.json secara langsung di GitHub. P9 hanya menghilangkan akses langsung melalui website dan tidak membuat repository menjadi private.
