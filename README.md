# MC Addon Share

**MC Addon Share** adalah website komunitas untuk berbagi dan menemukan
addon Minecraft Bedrock, resource pack, map, shader, APK, dan konten
terkait lainnya.

Website ini dibuat dengan fokus pada pengalaman mobile, pengelolaan
addon yang praktis, interaksi komunitas, serta sistem Admin dan Owner
untuk menjaga katalog tetap terkelola.

## ✨ Fitur

### 🏠 Beranda

-   Daftar addon dan konten Minecraft.
-   Pencarian berdasarkan nama, deskripsi, tipe file, versi Minecraft,
    dan kategori.
-   Filter kategori.
-   Filter versi Minecraft.
-   Pengurutan berdasarkan:
    -   Terbaru
    -   Paling banyak diunduh
    -   Paling banyak disukai
    -   Nama A--Z
-   Daftar addon populer/terbaru.
-   Navigasi mobile dengan Beranda, Cari, Disukai, dan Profil.

### 🔎 Pencarian & Discovery

-   Pencarian yang lebih fleksibel.
-   Filter kategori dan versi Minecraft.
-   Sorting untuk membantu menemukan konten yang dibutuhkan.
-   Optimasi pencarian agar tetap nyaman digunakan di perangkat mobile.

### 👤 Akun

-   Registrasi menggunakan username dan password.
-   Login persisten.
-   Logout.
-   Profil pengguna.
-   Badge dan tampilan berbeda berdasarkan role:
    -   User
    -   Admin
    -   Owner

### ❤️ Like & Disukai

-   Pengguna yang login dapat menyukai addon.
-   Daftar addon yang disukai tersedia melalui halaman Profil dan menu
    Disukai.
-   Like menggunakan identitas akun pengguna.

### 💬 Komentar

-   Komentar hanya dapat dibuat oleh pengguna yang login.
-   Mendukung reply.
-   Mendukung nested reply.
-   Reply disembunyikan secara default dan dapat dibuka.
-   Menampilkan username dan waktu komentar.
-   Maksimal 300 karakter per komentar/reply.

### 🛠️ Panel Admin

Admin dapat: - Menambahkan addon. - Mengedit addon. - Menggunakan
generator JSON. - Mengirim data addon langsung ke `data.json` melalui
server/API.

Admin **tidak** dapat: - Menghapus addon. - Mengelola role Admin. -
Melihat seluruh riwayat aktivitas Owner.

### 👑 Panel Owner

Owner memiliki akses pengelolaan yang lebih tinggi: - Menambahkan
addon. - Mengedit addon. - Menghapus addon. - Mengelola Admin. -
Menambahkan akun menjadi Admin. - Mencabut role Admin. - Melihat seluruh
riwayat aktivitas pengelolaan. - Melihat statistik dan informasi
pengelolaan.

### 📋 Riwayat Aktivitas

Sistem mencatat aktivitas pengelolaan seperti: - Tambah addon. - Edit
addon. - Hapus addon. - Tambah Admin. - Cabut Admin.

Riwayat aktivitas tersedia untuk Owner.

### 📊 Dashboard Statistik

Panel pengelolaan menyediakan informasi seperti: - Total addon. - Total
download. - Total like. - Jumlah addon berdasarkan kategori. - Ringkasan
aktivitas pengelolaan.

### 🔐 Validasi & Keamanan

-   Validasi data addon di sisi browser dan server.
-   Validasi URL.
-   Validasi slug.
-   Validasi kategori dan tipe file.
-   Batas panjang field.
-   Firebase Authentication untuk akun.
-   Firebase Realtime Database untuk data interaksi.
-   Firebase Rules untuk membatasi akses langsung.
-   Operasi pengelolaan addon dilakukan melalui API server.

## 🗂️ Struktur Data

Katalog utama menggunakan:

``` text
data.json
```

Setiap addon menggunakan struktur:

``` json
{
  "slug": "contoh_addon",
  "nama file": "Nama Addon",
  "type file": "Addon",
  "kategori": "addon",
  "link gambar": "https://contoh.com/gambar.jpg",
  "link download": "https://contoh.com/addon.mcaddon",
  "versi mc": "1.26+",
  "ukuran": "3 MB",
  "tanggal unggah": "16 September 2026",
  "description": "Deskripsi addon."
}
```

`data.json` menjadi katalog utama website.

File addon sebenarnya **tidak disimpan di repository website**. Link
download dapat mengarah ke layanan hosting file eksternal.

## 🔥 Teknologi

-   HTML
-   CSS
-   JavaScript
-   Firebase Authentication
-   Firebase Realtime Database
-   GitHub
-   GitHub API
-   Vercel Serverless Functions
-   JSON

## 🔐 Arsitektur

``` text
MC Addon Share
│
├── Frontend
│   ├── index.html
│   ├── detail.html
│   ├── profil.html
│   ├── admin.html
│   ├── owner.html
│   ├── script.js
│   ├── detail.js
│   └── style.css
│
├── Firebase
│   ├── Authentication
│   ├── Realtime Database
│   ├── Roles
│   ├── Komentar
│   ├── Like / Download
│   └── Aktivitas
│
├── Server API
│   ├── Add addon
│   ├── Update addon
│   ├── Delete addon
│   ├── Manage role
│   └── Activity
│
└── GitHub
    └── data.json
```

## 👥 Hak Akses

  Fitur                User   Admin   Owner
  ------------------- ------ ------- -------
  Melihat addon         ✅     ✅      ✅
  Like                  ✅     ✅      ✅
  Komentar              ✅     ✅      ✅
  Reply                 ✅     ✅      ✅
  Tambah addon          ❌     ✅      ✅
  Edit addon            ❌     ✅      ✅
  Hapus addon           ❌     ❌      ✅
  Kelola Admin          ❌     ❌      ✅
  Riwayat aktivitas     ❌     ❌      ✅
  Panel Admin           ❌     ✅      ✅
  Panel Owner           ❌     ❌      ✅

## 🚀 Deployment

Project dapat di-deploy menggunakan Vercel dengan repository GitHub.

Alur pengelolaan addon:

``` text
Admin / Owner
      ↓
Panel Pengelolaan
      ↓
Validasi data
      ↓
API Server
      ↓
GitHub API
      ↓
data.json
      ↓
Website
```

## ⚙️ Environment Variables

API server membutuhkan environment variables yang disimpan di Vercel.

Contoh nama variable:

``` text
GITHUB_TOKEN
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_DATABASE_URL
```

**Jangan memasukkan token GitHub, private key Firebase, password, atau
credential rahasia ke repository.**

## 🛡️ Catatan Keamanan

-   Jangan menyimpan secret di file frontend.
-   Gunakan Environment Variables untuk credential server.
-   Firebase Rules harus tetap dipublikasikan sesuai konfigurasi
    project.
-   `data.json` adalah data katalog dan tidak boleh diganti dengan file
    kosong atau versi lama saat melakukan update frontend.
-   File addon eksternal tidak dihapus ketika sebuah entry dihapus dari
    `data.json`.

## 📱 Fokus Mobile

MC Addon Share dirancang agar nyaman digunakan melalui perangkat mobile,
termasuk: - Layout responsif. - Navigasi bawah. - Kartu addon yang mudah
disentuh. - Optimasi pemuatan gambar. - Lazy loading. - Rendering daftar
yang lebih efisien. - Debounce pada pencarian.

## 📄 Lisensi

Lisensi project dapat ditentukan oleh pemilik repository.

Jika repository belum memiliki file lisensi, semua hak atas kode tetap
mengikuti ketentuan hak cipta yang berlaku dan tidak otomatis menjadi
domain publik.

## 🤝 Kontribusi

Kontribusi dapat dilakukan melalui repository GitHub dengan mengikuti
struktur dan aturan project.

Sebelum melakukan perubahan besar: 1. Pastikan fitur yang sudah ada
tidak rusak. 2. Jangan memasukkan credential rahasia. 3. Jangan
mengganti `data.json` dengan versi lama. 4. Uji perubahan pada perangkat
mobile jika perubahan berkaitan dengan UI. 5. Untuk perubahan
Firebase/API, uji hak akses User, Admin, dan Owner.

------------------------------------------------------------------------

**MC Addon Share**\
Platform berbagi dan menemukan konten Minecraft Bedrock.
