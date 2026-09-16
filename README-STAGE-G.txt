MC ADDON SHARE — STAGE G
GitHub otomatis untuk data.json

FUNGSI
- Panel Admin/Owner tetap membuat data addon seperti Stage F.
- Tombol "Tambahkan ke data.json" sekarang mengirim data ke /api/add-addon.
- API memverifikasi Firebase ID token dan role Admin/Owner.
- API mengambil data.json terbaru dari mayachan-fm/Share branch main.
- API menolak slug duplikat.
- API menambahkan addon lalu membuat commit ke GitHub.
- GITHUB_TOKEN dan Firebase Admin credentials hanya berada di Vercel Environment Variables.
- File addon (.mcaddon/.mcpack/.zip) tetap berada di layanan eksternal.

WAJIB DIKONFIGURASI DI VERCEL
1. Import/deploy repository mayachan-fm/Share ke Vercel seperti biasa.
2. Buka Vercel Project Settings -> Environment Variables.
3. Tambahkan:

GITHUB_TOKEN
  Fine-grained GitHub Personal Access Token.
  Repository access: hanya mayachan-fm/Share.
  Permission: Contents = Read and write.

FIREBASE_PROJECT_ID
  mcaddon-6c691

FIREBASE_CLIENT_EMAIL
  Nilai client_email dari Firebase service-account JSON.

FIREBASE_PRIVATE_KEY
  Nilai private_key dari Firebase service-account JSON.
  Jika Vercel meminta satu baris, biarkan escape \n tetap seperti nilai JSON.

FIREBASE_DATABASE_URL
  https://mcaddon-6c691-default-rtdb.asia-southeast1.firebasedatabase.app

PENTING KEAMANAN
- Jangan menaruh GITHUB_TOKEN di admin.html, script.js, auth.js, atau file lain yang dikirim ke browser.
- Jangan mengirim service-account JSON atau private key ke chat.
- Token GitHub cukup diberi akses Contents Read and write untuk repository Share.
- API tetap memeriksa role melalui Firebase Admin sebelum menulis.

FIREBASE SERVICE ACCOUNT
Di Firebase Console: Project settings -> Service accounts -> Generate new private key.
Ambil hanya project_id, client_email, dan private_key untuk Environment Variables Vercel.
Simpan file JSON aslinya secara aman dan jangan commit ke GitHub.

GITHUB TOKEN
Buat Fine-grained personal access token untuk repository mayachan-fm/Share.
Berikan Repository permissions -> Contents -> Read and write.
Tidak perlu menaruh token di kode website.

ALUR
Admin/Owner -> konfirmasi -> Vercel API -> Firebase role check -> GitHub GET data.json -> tambah data -> GitHub PUT data.json -> commit.

CATATAN
- API hanya menerima maksimal 20 addon per permintaan.
- data.json harus tetap berupa object seperti struktur sekarang.
- Jika slug sudah ada, seluruh operasi dibatalkan dan data.json tidak diubah.
- Jika GitHub mengembalikan conflict, ulangi setelah memastikan tidak ada perubahan bersamaan pada data.json.
