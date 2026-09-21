STAGE P9 FIX — DOWNLOAD GATE AUTH

Perbaikan: download-file.js sebelumnya hanya membaca Firebase Authorization header. Form POST dari detail.js tidak mengirim header tersebut, sehingga gate untuk user login/Premium gagal dengan pesan token belum siap atau sudah digunakan.

Perubahan:
- detail.js mengirim Firebase ID token sebagai field POST idToken.
- api/download-file.js memverifikasi idToken jika Authorization header tidak tersedia.
- Guest tetap tidak mengirim token dan tetap memakai gate biasa.
- Premium/Admin/Owner tetap diverifikasi ulang di server.
