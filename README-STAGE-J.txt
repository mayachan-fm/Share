MC Addon Share — Stage J

Fitur baru:
- Admin/Owner dapat menghapus addon dari data.json melalui Panel Admin.
- Ada 2 konfirmasi sebelum penghapusan.
- Penghapusan hanya menghapus entri dari data.json.
- File addon yang berada di layanan eksternal (MediaFire/Catbox/dll.) TIDAK ikut dihapus.
- API memverifikasi Firebase ID token dan role admin/owner di server.
- GitHub token tetap hanya di Environment Variables Vercel.

API baru:
/api/delete-addon.js

Repository:
mayachan-fm/Share
branch: main
file: data.json

Jangan mengganti data.json dengan file dari ZIP ini. Pertahankan data.json terbaru di repository.
