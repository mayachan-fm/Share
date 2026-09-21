MC ADDON SHARE — STAGE I
Panel Owner: Kelola Admin

FITUR
- Owner dapat melihat daftar Admin/Owner.
- Owner dapat menjadikan akun Firebase yang sudah ada sebagai Admin menggunakan email atau username.
- Owner dapat mencabut role Admin; akun kembali menjadi User.
- Owner tidak dapat mengubah/mencabut role Owner.
- Tidak ada password yang disimpan di Realtime Database.
- Perubahan role dilakukan oleh server melalui Firebase Admin SDK.

FILE BARU
- api/manage-role.js
- owner.html diperbarui

ENVIRONMENT VARIABLES
Stage I memakai variable yang sama seperti Stage G:
GITHUB_TOKEN
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_DATABASE_URL

PEMASANGAN
1. Pertahankan data.json yang ada di repository.
2. Ganti owner.html dengan versi Stage I.
3. Ganti style.css dengan versi Stage I.
4. Tambahkan api/manage-role.js.
5. Pastikan package.json tetap memiliki firebase-admin.
6. Commit ke branch main dan tunggu Vercel deploy.

CATATAN
- Endpoint /api/manage-role hanya menerima POST.
- Endpoint memverifikasi Firebase ID token dan memastikan role caller adalah owner.
- Firebase Realtime Database rules roles/$uid tetap boleh .write=false karena Firebase Admin SDK berjalan di server dan melewati Rules.
