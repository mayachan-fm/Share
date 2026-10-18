Perbaikan batas Serverless Functions Vercel Hobby

File yang diubah:
- api/notifications.js: menggabungkan handler laporan addon ke endpoint notifikasi yang sudah ada, dengan action=reports.
- script.js: pengiriman laporan dari kartu addon menggunakan /api/notifications?action=reports.
- detail.js: pengiriman laporan dari halaman detail menggunakan /api/notifications?action=reports.
- owner.html: pengelolaan laporan Owner menggunakan /api/notifications?action=reports.

File yang dihapus dari repositori:
- api/reports.js (hapus file lama ini di GitHub setelah mengganti file yang diubah).

Tidak ada file lain yang dihapus dari proyek. data.json tidak diubah.

Penting: salin file dari ZIP ke jalur yang sama. Kemudian hapus api/reports.js dari repositori GitHub. Jumlah fungsi API JavaScript akan turun dari 13 menjadi 12. Setelah deploy, uji notifikasi dan seluruh alur laporan.
