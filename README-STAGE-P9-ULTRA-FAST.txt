P9 — Ultra Fast Privileged Download

Tujuan: mengurangi jeda 4–5 detik pada Premium/Admin/Owner tanpa melemahkan gate untuk user biasa.

Perubahan:
1. detail.js hanya meminta satu addon melalui /api/catalog?slug=...
2. Jika Premium/Admin/Owner, catalog API memverifikasi akses saat halaman detail dimuat dan membuat token download HMAC singkat (5 menit).
3. Klik Download privileged langsung memakai token tersebut; tidak memanggil /api/download-gate.
4. download-file.js memproses token privileged tanpa verifyIdToken/query role/premium kedua.
5. User biasa tetap memakai gate 10–20 detik dan readyAt server-side.
6. Katalog publik tetap tidak mengirim link download.
7. Tidak ada file yang dihapus.
