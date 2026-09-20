STAGE P3 — AUTO-EXPIRATION PREMIUM
MC Addon Share

Perubahan:
- Status Premium otomatis dihitung berdasarkan timestamp berakhir.
- Premium yang melewati waktu berakhir langsung dianggap tidak aktif tanpa menghapus data Firebase.
- API daftar Premium mengembalikan status Aktif/Kedaluwarsa/Dicabut serta sisa waktu untuk Premium aktif.
- Panel Owner menampilkan status, tanggal berakhir, dan perkiraan sisa waktu.
- Panel Owner memperbarui tampilan sisa waktu setiap menit. Jika ada Premium yang baru kedaluwarsa, daftar dimuat ulang otomatis.
- Premium Permanen tidak memiliki waktu kedaluwarsa.
- Premium yang dicabut tetap tersimpan sebagai riwayat dan tidak kembali aktif karena timer.

Tidak diubah pada P3:
- Perpanjangan yang menambahkan sisa waktu (P4).
- Tampilan Premium di Profil (P5).
- Download Gate dan artikel (P6-P9).
- Riwayat Premium terpisah (P10).

Pengujian:
1. Deploy Stage P3 ke Vercel.
2. Beri Premium dengan durasi pendek hanya untuk pengujian jika tersedia; produksi tetap memakai 7/30/90 hari.
3. Pastikan Premium aktif sebelum expiresAt.
4. Setelah waktu expiresAt lewat, status berubah menjadi Kedaluwarsa dan akses Premium akan dianggap tidak aktif oleh premium.js.
5. Pastikan data premium/<uid> tetap ada di Firebase.
6. Pastikan Premium Permanen tetap Aktif.
7. Pastikan Premium yang dicabut tetap berstatus Dicabut.
