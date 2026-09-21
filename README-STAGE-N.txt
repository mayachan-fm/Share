Stage N — Penguatan Firebase Rules

Tujuan:
- Mencegah client mengubah node yang seharusnya hanya dikelola server.
- Like hanya dapat ditambah oleh user yang login dan harus naik tepat 1.
- Download tetap dapat dilakukan tanpa login, tetapi perubahan harus naik tepat 1.
- Komentar/reply hanya dapat dibuat oleh user login, hanya oleh UID pemilik token, dan maksimal 300 karakter.
- Role tidak dapat ditulis dari browser.
- Riwayat aktivitas tidak dapat dibaca/ditulis langsung dari browser; API server menggunakan Firebase Admin SDK.

File:
- firebase-rules-stage-n.json

Cara pemasangan:
1. Buka Firebase Console > Realtime Database > Rules.
2. Backup/copy rules lama terlebih dahulu.
3. Ganti seluruh isi Rules dengan isi firebase-rules-stage-n.json.
4. Publish.
5. Tes login, like, download, komentar, reply, Panel Admin, dan Panel Owner.

Catatan:
- Rules ini tidak mencegah spam download/like dari banyak request yang sah; rate limiting dapat menjadi tahap terpisah.
- Jangan mengubah data.json.
