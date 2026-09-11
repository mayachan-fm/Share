MC Addon Share — Tahap B (Firebase CDN + Akun)

Firebase SDK memakai CDN resmi Google gstatic v12.18.0.

Firebase Console yang diperlukan:
1. Authentication -> Sign-in method -> Email/Password = Enabled.
2. Tidak perlu mengaktifkan Google, Phone, atau Anonymous.
3. Realtime Database Rules tidak perlu diubah untuk Tahap B.

Sistem akun:
- Pengguna memasukkan username + password saja.
- Website membuat alamat email internal untuk Firebase Authentication.
- Password tidak disimpan mentah di Realtime Database.
- Login Firebase otomatis mempertahankan sesi pada perangkat.
- Username ditampilkan di halaman Profil.

Catatan testing:
- Jalankan website melalui server seperti localhost atau hosting, bukan file://.
- Username: 3-20 karakter, hanya huruf, angka, dan _.
- Password: minimal 6 karakter.


FIX 3: Jika pendaftaran gagal, halaman sekarang menampilkan kode error Firebase yang sebenarnya agar penyebab dapat diketahui. Pastikan localhost ada di Authentication > Settings > Authorized domains.
