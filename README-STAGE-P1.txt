STAGE P1 — STRUKTUR SISTEM PREMIUM
MC Addon Share

Tujuan:
- Menyiapkan fondasi data Premium tanpa mengubah tombol Download.
- Premium menjadi akses tambahan, bukan pengganti role User/Admin/Owner.
- Status aktif dihitung dari waktu kedaluwarsa.

File baru:
- premium.js
- firebase-rules-stage-p1.json

File diubah:
- auth.js

Struktur Firebase:

premium/
  UID_USER/
    tipe: "7_hari" | "30_hari" | "90_hari" | "permanen"
    mulai: <timestamp milidetik>
    berakhir: <timestamp milidetik atau null>

Untuk Premium permanen, berakhir bernilai null.

Catatan:
- P1 BELUM memberikan Premium kepada akun mana pun.
- P1 BELUM menambahkan panel Kelola Premium.
- P1 BELUM mengubah Download menjadi melewati gate.
- P1 BELUM membuat timer/artikel.
- Data Premium yang sudah kedaluwarsa tidak perlu dihapus. Sistem menghitung status dari waktu saat ini.

Firebase Rules:
- User hanya dapat membaca data Premium miliknya sendiri.
- Client tidak dapat menulis node premium.
- Pemberian Premium nantinya dilakukan server-side oleh Owner pada Stage P2.

Pemasangan Rules:
- Buka Firebase Console > Realtime Database > Rules.
- Jangan mengganti seluruh Rules dengan file ini jika Rules produksi sudah memiliki perubahan lain tanpa membandingkannya terlebih dahulu.
- Gunakan bagian "premium" dari file ini untuk ditambahkan ke Rules yang sedang aktif.
