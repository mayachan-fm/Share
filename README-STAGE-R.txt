STAGE R — OPTIMASI MOBILE & PERFORMA

Perubahan:
- index.html: theme-color dan preconnect CDN.
- script.js: rendering daftar memakai DocumentFragment, pembacaan like lokal lebih aman/efisien, pencarian memakai debounce ringan, gambar memakai decoding async, dan slug detail di-encode.
- style.css: content-visibility/contain untuk kartu serta penyesuaian ringan layar kecil.

File yang diganti:
- index.html
- script.js
- style.css

JANGAN mengganti data.json.

Catatan:
- Firebase, auth, role, API, komentar, dan data katalog tidak diubah oleh tahap ini.
- Setelah deploy, tes pencarian, filter, like, tombol share, top addon, buka detail, dan tampilan HP.
