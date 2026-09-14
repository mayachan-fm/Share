MC ADDON SHARE — STAGE E
Sistem Role User / Admin / Owner

1. USER
- Daftar/login memakai username + password.
- Username dikonversi ke email internal Firebase.
- Hak: like, komentar, reply.
- Jika UID tidak memiliki role khusus, otomatis dianggap "user".

2. ADMIN
- Login memakai email + password Firebase.
- Akun Admin tidak dibuat dari form daftar User.
- UID Admin harus dimasukkan manual ke Realtime Database:
  roles/<UID_ADMIN> = "admin"

3. OWNER
- Login memakai email + password Firebase.
- UID Owner harus dimasukkan manual:
  roles/<UID_OWNER> = "owner"

4. STRUKTUR ROLE
roles/
  <uid> : "admin"
  <uid> : "owner"

Jangan masukkan password ke database role.

5. CARA MENDAPATKAN UID
- Firebase Console
- Authentication
- Users
- Cari akun Admin/Owner
- Salin User UID

6. CATATAN KEAMANAN
Stage E menyiapkan pemisahan akun dan panel berdasarkan role.
Hak upload/penghapusan yang benar-benar aman belum diberikan pada tahap ini.
Pada tahap Upload/Owner, Firebase Rules + backend/API harus mengontrol operasi
istimewa. Jangan menaruh secret storage eksternal di JavaScript frontend.

7. FILE BARU
- auth.js        : Auth + pembacaan role
- admin.html     : panel Admin/Owner sementara
- owner.html     : panel Owner sementara
- profil.html    : pilihan login User atau Admin/Owner
