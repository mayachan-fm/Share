// ==============================================
// KONFIGURASI FIREBASE (Mcaddon Project)
// ==============================================
const firebaseConfig = {
  apiKey: "AIzaSyDSVDvod7D4K-JJ4zXJq_HW0woxUzEhmEY",
  authDomain: "mcaddon-6c691.firebaseapp.com",
  databaseURL: "https://mcaddon-6c691-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mcaddon-6c691",
  storageBucket: "mcaddon-6c691.firebasestorage.app",
  messagingSenderId: "769674524186",
  appId: "1:769674524186:web:05e8c5f4e34867980b03a3"
};
import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { auth, onAuthStateChanged } from "./auth.js";
import { getDatabase, ref, get, set, increment } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
// ==============================================
// TEMA TAMPILAN GLOBAL — terapkan tema tersimpan dari localStorage
// (dipilih di halaman Profil, key 'tema-mcaddon'). Dijalankan secepat
// mungkin agar tema langsung aktif tanpa kedip yang berarti.
// ==============================================
(function terapkanTemaGlobal() {
    try {
        const id = localStorage.getItem('tema-mcaddon') || 'default';
        const html = document.documentElement;
        ['tema-default','tema-gelap','tema-nether','tema-end','tema-emerald'].forEach(c => html.classList.remove(c));
        if (id && id !== 'default') html.classList.add('tema-' + id);
    } catch (_) {}
})();
const app = getApp();
const db = getDatabase(app);
let penggunaLogin = null;
let authSiap = false;
onAuthStateChanged(auth, (user) => {
    penggunaLogin = user;
    authSiap = true;
    if (Object.keys(semuaDataAddon).length) terapkanFilterDanCari();
});
function kunciLikePengguna() {
    return penggunaLogin ? `sudahLike_${penggunaLogin.uid}` : "sudahLike_tidak_login";
}
function ambilDaftarLikeLokal() {
    if (!penggunaLogin) return [];
    try {
        return JSON.parse(localStorage.getItem(kunciLikePengguna()) || '[]');
    } catch {
        return [];
    }
}
function tampilkanKartuLogin() {
    if (document.getElementById("kartu-login-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "kartu-login-overlay";
    overlay.className = "login-overlay";
    overlay.innerHTML = `
        <div class="login-card">
            <button class="login-tutup" type="button" aria-label="Tutup">×</button>
            <div class="profil-avatar"><i class="fa fa-user"></i></div>
            <h3>Login diperlukan</h3>
            <p>Silakan login atau daftar terlebih dahulu untuk menggunakan Like.</p>
            <a href="profil.html" class="tombol-utama tombol-login-lanjut">Login / Daftar</a>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".login-tutup").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}
let semuaDataAddon = {};
let daftarAddon = [];
let filterAktif = 'semua';
let modeTopAddon = 'terbanyak'; // Bawaan: Paling Banyak Diunduh
let urutanDaftar = 'terbaru';
let versiAktif = 'semua';
let batasPilihanAddon = 8;
const jumlahTambahPilihanAddon = 8;
let daftarTerfilter = null;        // null = tidak ada pencarian/kategori aktif
let filterSebelumnyaAktif = false; // hindari render ulang "Semua Koleksi" tiap ketik
// === PAGINASI SEMUA KOLEKSI ===
const ITEM_PER_HALAMAN = 20;
let halamanAktif = 1;
let dataSaatIniUntukPaginasi = [];
// ==============================================
// SUNTIK CSS PAGINASI (sesuai tema: gelap + aksen merah)
// ==============================================
(function suntikCssPaginasi() {
    if (document.getElementById('css-paginasi-addon')) return;
    const css = `
    .kontrol-paginasi { margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0 20px; }
    .info-paginasi { font-size: 12px; color: #b0b0b0; }
    .baris-paginasi { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; }
    .tombol-paginasi { min-width: 40px; padding: 9px 12px; border-radius: 8px; border: 2px solid #333; background: #1a1a1a; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s ease; display: inline-flex; align-items: center; gap: 6px; }
    .tombol-paginasi:hover:not(:disabled) { border-color: #ff3b30; color: #ff3b30; }
    .tombol-paginasi.aktif { background: #ff3b30; border-color: #ff3b30; color: #fff; }
    .tombol-paginasi:disabled { opacity: .35; cursor: not-allowed; }
    .titik-paginasi { color: #b0b0b0; padding: 0 4px; font-size: 14px; }
    .badge-diperbarui { position: absolute; top: 12px; right: 12px; z-index: 2; background: #34c759; color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(0,0,0,.45); }
    .skeleton-card { pointer-events:none; cursor:default; }
    .skeleton-card:hover { transform:none !important; box-shadow:none !important; }
    .skeleton-img { width:100%; height:140px; background:linear-gradient(90deg,#1a1a1a 25%,#2a2a2a 37%,#1a1a1a 63%); background-size:400% 100%; animation:skeletonShimmer 1.4s ease infinite; }
    .skeleton-line { height:12px; border-radius:6px; background:linear-gradient(90deg,#1a1a1a 25%,#2a2a2a 37%,#1a1a1a 63%); background-size:400% 100%; animation:skeletonShimmer 1.4s ease infinite; }
    @keyframes skeletonShimmer { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
    `;
    const style = document.createElement('style');
    style.id = 'css-paginasi-addon';
    style.textContent = css;
    document.head.appendChild(style);
})();
// ==============================================
// PARSING WAKTU UNTUK SORTING "TERBARU" (upload + edit)
// ==============================================
const BULAN_INDO = { januari:0, februari:1, feb:1, maret:2, mar:2, april:3, apr:3, mei:4, juni:5, jun:5, juli:6, jul:6, agustus:7, agu:7, september:8, sep:8, oktober:9, okt:9, november:10, nov:10, desember:11, des:11 };
function parseTanggalIndo(str) {
    const m = String(str || '').trim().toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (!m) return NaN;
    const bulan = BULAN_INDO[m[2]];
    if (bulan === undefined) return NaN;
    return new Date(Number(m[3]), bulan, Number(m[1])).getTime();
}
// Waktu terakhir diperbarui: utamakan "tanggal diperbarui" (hanya ada jika pernah diedit),
// fallback ke "tanggal unggah".
function waktuTerbaru(item) {
    const tEdit = parseTanggalIndo(item && item['tanggal diperbarui']);
    if (!isNaN(tEdit)) return tEdit;
    const t = parseTanggalIndo(item && item['tanggal unggah']);
    return isNaN(t) ? 0 : t;
}
// Badge "Diperbarui": hanya tampil jika addon diedit dalam N hari terakhir.
const HARI_BARU_DIperbarui = 14;
function baruDiperbarui(item) {
    if (!item) return false;
    // Pengaman backfill: jika "tanggal diperbarui" sama dengan "tanggal unggah",
    // artinya addon belum pernah diedit (hanya di-backfill) -> badge tidak tampil.
    const tEdit = String(item['tanggal diperbarui'] || '').trim().toLowerCase();
    const tUnggah = String(item['tanggal unggah'] || '').trim().toLowerCase();
    if (tEdit && tEdit === tUnggah) return false;
    const t = parseTanggalIndo(item['tanggal diperbarui']);
    if (isNaN(t)) return false;
    return (Date.now() - t) <= HARI_BARU_DIperbarui * 24 * 60 * 60 * 1000;
}
// Skeleton loading — kerangka kartu berkedip saat data dimuat (hanya jika wadah masih kosong).
function tampilkanSkeleton() {
    const top = document.getElementById('wadah-top');
    const grid = document.getElementById('wadah-addon');
    const kartuSkeleton = (untukGrid) => `
        <div class="kartu-addon ${untukGrid ? '' : 'kartu-geser'} skeleton-card" aria-hidden="true">
            <div class="gambar-wadah"><div class="skeleton-img"></div></div>
            <div class="kartu-isi">
                <div class="skeleton-line" style="width:82%"></div>
                <div class="skeleton-line" style="width:52%;margin-top:10px"></div>
            </div>
        </div>`;
    if (top && !top.children.length) top.innerHTML = Array(3).fill(kartuSkeleton(false)).join('');
    if (grid && !grid.children.length) grid.innerHTML = Array(6).fill(kartuSkeleton(true)).join('');
}
// ==============================================
// TOTAL PENGGUNA — ambil dari /api/public-stats (publik, cache 60 detik)
// ==============================================
async function muatTotalPengguna() {
    try {
        const respon = await fetch('/api/public-stats', { cache: 'no-store' });
        if (!respon.ok) return;
        const data = await respon.json();
        if (!data || !data.ok || typeof data.totalPengguna !== 'number') return;
        // Cari elemen angka Total Pengguna: coba id umum, lalu cari via teks <p>.
        let el = document.getElementById('jumlah-pengguna')
              || document.getElementById('jumlah-user')
              || document.getElementById('total-pengguna');
        if (!el) {
            document.querySelectorAll('.kotak-info p').forEach((p) => {
                if (!el && /total\s*pengguna/i.test(p.textContent || '')) {
                    const span = (p.parentElement && p.parentElement.querySelector('span')) || p.closest('.kotak-info')?.querySelector('span');
                    if (span) el = span;
                }
            });
        }
        if (el) el.textContent = data.totalPengguna;
    } catch (_) {
        // Gagal ambil? biarkan tetap 0 / apa adanya, tidak ganggu yang lain.
    }
}
function tampilkanAddonDisukaiDariUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("disukai") !== "1") return false;
    const wadah = document.getElementById("wadah-addon");
    if (!wadah) return false;
    const disukai = ambilDaftarLikeLokal();
    const hasil = penggunaLogin ? daftarAddon.filter(item => disukai.includes(item.slug)) : [];
    filterAktif = "semua";
    daftarTerfilter = null;
    filterSebelumnyaAktif = false;
    document.querySelectorAll(".btn-kategori").forEach(b => b.classList.remove("aktif"));
    document.querySelector('.btn-kategori[data-filter="semua"]')?.classList.add("aktif");
    const judul = document.querySelector(".daftar-addon .judul-bagian");
    if (judul) judul.innerHTML = "👍 Addon Disukai";
    if (!penggunaLogin) {
        wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-user"></i><p>Login diperlukan</p><span>Silakan login untuk melihat addon yang kamu sukai.</span><br><a href="profil.html" class="tombol-utama tombol-login-lanjut">Login / Daftar</a></div>`;
    } else {
        tampilkanDaftar(hasil);
    }
    document.querySelector(".daftar-addon")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
}
// ==============================================
// MUAT DATA AWAL
// ==============================================
async function tampilkanAddon() {
    const wadah = document.getElementById('wadah-addon');
    try {
        tampilkanSkeleton(); // kerangka loading saat data dimuat
        const respon = await fetch('/api/catalog', { cache: 'no-store' });
        if (!respon.ok) throw new Error(`File tidak ditemukan (Kode: ${respon.status})`);

        semuaDataAddon = await respon.json();
        daftarAddon = Object.values(semuaDataAddon);
        console.log("✅ Data berhasil dimuat:", semuaDataAddon);
        // Ambil data unduhan & like dari Firebase
        try {
            const unduhRef = ref(db, 'jumlah_unduh');
            const likeRef = ref(db, 'jumlah_like');
            const [snapUnduh, snapLike] = await Promise.all([get(unduhRef), get(likeRef)]);
            const dataUnduh = snapUnduh.exists() ? snapUnduh.val() : {};
            const dataLike = snapLike.exists() ? snapLike.val() : {};
            Object.entries(semuaDataAddon).forEach(([idAddon, item]) => {
                item['jumlah unduh'] = dataUnduh[idAddon] || item['jumlah unduh'] || 0;
                item['jumlah like'] = dataLike[idAddon] || item['jumlah like'] || 0;
            });
        } catch (firebaseErr) {
            console.warn("⚠️ Data Firebase tidak dimuat:", firebaseErr);
        }
        // Update statistik total
        document.getElementById('jumlah-total').textContent = daftarAddon.length;
        const totalUnduh = daftarAddon.reduce((jml, item) => jml + (item['jumlah unduh'] || 0), 0);
        document.getElementById('jumlah-unduh-total').textContent = totalUnduh;
        muatTotalPengguna(); // Total Pengguna dari /api/public-stats
        tampilkanTopAddon();
        wadah.innerHTML = '';
        tampilkanDaftar(daftarAddon);
        aturFilterKategori();
        isiPilihanVersi();
        tampilkanAddonDisukaiDariUrl();
    } catch (error) {
        console.error("❌ Gagal memuat data:", error);
        wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-exclamation-triangle"></i><p>Belum bisa memuat data</p><span>Pastikan katalog server tersedia & formatnya benar</span><br><small>Detail: ${error.message}</small></div>`;
    }
}
// ==============================================
// TAMPILKAN TOP ADDON — DENGAN PILIHAN TAB
// ==============================================
function tampilkanTopAddon() {
    const wadah = document.getElementById('wadah-top');
    if (!wadah || daftarAddon.length === 0) return;
    // Sumber: hasil pencarian/kategori jika aktif, jika tidak pakai seluruh katalog.
    const sumberAwal = daftarTerfilter !== null ? daftarTerfilter : daftarAddon;
    const judulEl = document.querySelector('.bagian-top-addon .judul-bagian');
    if (judulEl) judulEl.innerHTML = daftarTerfilter !== null ? '🔍 Hasil Pencarian' : '🔥 Pilihan Addon';
    let sumber = [...sumberAwal];
    if (versiAktif !== 'semua') {
        sumber = sumber.filter(item => String(item['versi mc'] || '').trim() === versiAktif);
    }
    let terurut;
    if (urutanDaftar === 'terbanyak') {
        terurut = sumber.sort((a, b) => (b['jumlah unduh'] || 0) - (a['jumlah unduh'] || 0));
    } else if (urutanDaftar === 'like') {
        terurut = sumber.sort((a, b) => (b['jumlah like'] || 0) - (a['jumlah like'] || 0));
    } else if (urutanDaftar === 'nama') {
        terurut = sumber.sort((a, b) => String(a['nama file'] || '').localeCompare(String(b['nama file'] || ''), undefined, { sensitivity: 'base' }));
    } else {
        // Terbaru: urutkan berdasarkan waktu terakhir diperbarui (edit > upload).
        terurut = sumber.sort((a, b) => waktuTerbaru(b) - waktuTerbaru(a));
    }
    const totalTersedia = terurut.length;
    terurut = terurut.slice(0, batasPilihanAddon);
    wadah.innerHTML = '';
    if (terurut.length === 0) {
        wadah.innerHTML = `<div class="pesan-hilang"><i class="fa fa-search-minus"></i><p>Addon tidak ditemukan</p></div>`;
        return;
    }
    terurut.forEach((item) => {
        const kartu = document.createElement('div');
        kartu.className = 'kartu-addon kartu-geser';
        kartu.dataset.kategori = item.kategori || 'lainnya';
        kartu.innerHTML = `
            <div class="gambar-wadah">
                ${baruDiperbarui(item) ? '<span class="badge-diperbarui"><i class="fa fa-refresh"></i> Diperbarui</span>' : ''}
                <img src="${item['link gambar']}" alt="${item['nama file']}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/300x160/ff3b30/ffffff?text=Gambar+Tidak+Ada'">
            </div>
            <div class="kartu-isi">
                <h4>${item['nama file']}</h4>
                <div class="info-unduh">
                    <i class="fa fa-download"></i>
                    ${item['jumlah unduh'] || 0} unduhan
                </div>
            </div>
        `;
        kartu.addEventListener('click', () => window.location.href = `detail.html?slug=${item.slug}`);
        wadah.appendChild(kartu);
    });
    // Tombol panah di ujung Pilihan Addon untuk menampilkan batch berikutnya.
    if (batasPilihanAddon < totalTersedia) {
        const tombolLanjut = document.createElement('button');
        tombolLanjut.type = 'button';
        tombolLanjut.className = 'tombol-lanjut-pilihan';
        tombolLanjut.setAttribute('aria-label', 'Tampilkan lebih banyak addon');
        tombolLanjut.innerHTML = '<i class="fa fa-arrow-right"></i>';
        tombolLanjut.addEventListener('click', (event) => {
            event.stopPropagation();
            batasPilihanAddon += jumlahTambahPilihanAddon;
            tampilkanTopAddon();
            requestAnimationFrame(() => {
                wadah.scrollTo({ left: wadah.scrollWidth, behavior: 'smooth' });
            });
        });
        wadah.appendChild(tombolLanjut);
    }
}
// ==============================================
// FUNGSI PILIHAN TAB — PALING BANYAK / BARU DIUNGGAH
// ==============================================
function aturTabTopAddon() {
    document.querySelectorAll('.tab-top').forEach(tombol => {
        tombol.addEventListener('click', () => {
            document.querySelectorAll('.tab-top').forEach(b => b.classList.remove('aktif'));
            tombol.classList.add('aktif');
            modeTopAddon = tombol.dataset.urut;
            tampilkanTopAddon();
        });
    });
}
// ==============================================
// TAMPILKAN DAFTAR UTAMA — DENGAN PAGINASI (20 per halaman)
// ==============================================
function tampilkanDaftar(dataYangDitampilkan, resetHalaman = true) {
    if (resetHalaman) halamanAktif = 1;
    dataSaatIniUntukPaginasi = dataYangDitampilkan;
    const wadah = document.getElementById('wadah-addon');
    wadah.innerHTML = '';
    if (dataYangDitampilkan.length === 0) {
        wadah.innerHTML = `<div class="pesan-hilang"><i class="fa fa-search-minus"></i><p>Addon tidak ditemukan</p></div>`;
        return;
    }
    const totalHalaman = Math.max(1, Math.ceil(dataYangDitampilkan.length / ITEM_PER_HALAMAN));
    if (halamanAktif > totalHalaman) halamanAktif = totalHalaman;
    const mulaiIdx = (halamanAktif - 1) * ITEM_PER_HALAMAN;
    const iris = dataYangDitampilkan.slice(mulaiIdx, mulaiIdx + ITEM_PER_HALAMAN);
    const fragmen = document.createDocumentFragment();
    const daftarLike = ambilDaftarLikeLokal();
    iris.forEach((item) => {
        const kartu = document.createElement('div');
        kartu.className = 'kartu-addon';
        kartu.dataset.kategori = item.kategori || 'lainnya';
        const tipeFile = item['type file'] ? `<span class="tipe-file">${item['type file']}</span>` : '';
        const linkDetail = `detail.html?slug=${encodeURIComponent(item.slug)}`;
        const sudahDiLike = daftarLike.includes(item.slug);
        const jumlahLike = item['jumlah like'] || 0;
        kartu.innerHTML = `
            <div class="gambar-wadah">
                ${tipeFile}
                ${baruDiperbarui(item) ? '<span class="badge-diperbarui"><i class="fa fa-refresh"></i> Diperbarui</span>' : ''}
                <img src="${item['link gambar']}" alt="${item['nama file']}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/400x180/ff3b30/ffffff?text=Gambar+Tidak+Ada'">
            </div>
            <div class="kartu-isi">
                <h3>${item['nama file']}</h3>
                <div class="garis-pembatas"></div>
                <div class="bagian-aksi">
                    <div class="info-unduh"><i class="fa fa-download"></i> ${item['jumlah unduh'] || 0}</div>
                    <div class="grup-tombol-kanan">
                        <button class="tombol-like ${sudahDiLike ? 'sudah' : ''}" data-slug="${item.slug}">
                            <i class="fa fa-thumbs-up"></i> <span>${jumlahLike}</span>
                        </button>
                        <button class="tombol-bagi" data-link="${window.location.origin}${window.location.pathname.replace('index.html','')}${linkDetail}">
                            <i class="fa fa-link"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        kartu.addEventListener('click', e => {
            if (!e.target.closest('.tombol-bagi') && !e.target.closest('.tombol-like')) window.location.href = linkDetail;
        });
        kartu.querySelector('.tombol-bagi').addEventListener('click', e => {
            e.stopPropagation();
            salinLink(e.currentTarget.dataset.link);
        });
        kartu.querySelector('.tombol-like').addEventListener('click', async e => {
            e.stopPropagation();
            const tombol = e.currentTarget;
            const slug = tombol.dataset.slug;
            if (!authSiap) return;
            if (!penggunaLogin) {
                tampilkanKartuLogin();
                return;
            }
            const kunci = kunciLikePengguna();
            const daftar = ambilDaftarLikeLokal();
            if (!daftar.includes(slug)) {
                daftar.push(slug);
                localStorage.setItem(kunci, JSON.stringify(daftar));
                const idAddon = Object.keys(semuaDataAddon).find(k => semuaDataAddon[k].slug === slug);
                if (!idAddon) return;
                const refLike = ref(db, 'jumlah_like/' + idAddon);
                const snap = await get(refLike);
                const baru = (snap.exists() ? snap.val() : 0) + 1;
                await set(refLike, baru);
                semuaDataAddon[idAddon]['jumlah like'] = baru;
                tombol.classList.add('sudah');
                tombol.querySelector('span').textContent = baru;
            }
        });
        fragmen.appendChild(kartu);
    });
    wadah.appendChild(fragmen);
    // Tampilkan kontrol paginasi hanya jika lebih dari 1 halaman.
    if (totalHalaman > 1) {
        wadah.appendChild(buatKontrolPaginasi(totalHalaman));
    }
}
// ==============================================
// KONTROL PAGINASI — Sebelumnya / Nomor / Berikutnya
// ==============================================
function buatKontrolPaginasi(totalHalaman) {
    const nav = document.createElement('div');
    nav.className = 'kontrol-paginasi';

    const info = document.createElement('div');
    info.className = 'info-paginasi';
    info.textContent = `Halaman ${halamanAktif} dari ${totalHalaman}`;
    nav.appendChild(info);

    const baris = document.createElement('div');
    baris.className = 'baris-paginasi';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'tombol-paginasi';
    prev.innerHTML = '<i class="fa fa-arrow-left"></i> Sebelumnya';
    prev.disabled = halamanAktif === 1;
    prev.addEventListener('click', () => pergiKeHalaman(halamanAktif - 1));
    baris.appendChild(prev);

    daftarNomorHalaman(totalHalaman, halamanAktif).forEach((n) => {
        if (n === '...') {
            const titik = document.createElement('span');
            titik.className = 'titik-paginasi';
            titik.textContent = '…';
            baris.appendChild(titik);
        } else {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tombol-paginasi nomor' + (n === halamanAktif ? ' aktif' : '');
            btn.textContent = n;
            btn.addEventListener('click', () => pergiKeHalaman(n));
            baris.appendChild(btn);
        }
    });

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'tombol-paginasi';
    next.innerHTML = 'Berikutnya <i class="fa fa-arrow-right"></i>';
    next.disabled = halamanAktif === totalHalaman;
    next.addEventListener('click', () => pergiKeHalaman(halamanAktif + 1));
    baris.appendChild(next);

    nav.appendChild(baris);
    return nav;
}
function pergiKeHalaman(n) {
    halamanAktif = n;
    tampilkanDaftar(dataSaatIniUntukPaginasi, false);
    document.querySelector('.daftar-addon')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function daftarNomorHalaman(total, saatIni) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const hal = [1];
    const mulai = Math.max(2, saatIni - 1);
    const akhir = Math.min(total - 1, saatIni + 1);
    if (mulai > 2) hal.push('...');
    for (let i = mulai; i <= akhir; i++) hal.push(i);
    if (akhir < total - 1) hal.push('...');
    hal.push(total);
    return hal;
}
// ==============================================
// FUNGSI FILTER & CARI
// ==============================================
function aturFilterKategori() {
    document.querySelectorAll('.btn-kategori').forEach(tombol => {
        tombol.addEventListener('click', () => {
            document.querySelectorAll('.btn-kategori').forEach(b => b.classList.remove('aktif'));
            tombol.classList.add('aktif');
            filterAktif = tombol.dataset.filter;
            terapkanFilterDanCari();
        });
    });
}
function isiPilihanVersi() {
    const select = document.getElementById('filter-versi');
    if (!select) return;
    const versi = [...new Set(daftarAddon.map(item => String(item['versi mc'] || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    select.innerHTML = '<option value="semua">Semua versi</option>' + versi.map(v => `<option value="${encodeURIComponent(v)}">${v}</option>`).join('');
    select.value = versiAktif === 'semua' ? 'semua' : encodeURIComponent(versiAktif);
}
function terapkanUrutan(data) {
    const hasil = [...data];
    if (urutanDaftar === 'terbanyak') return hasil.sort((a, b) => (b['jumlah unduh'] || 0) - (a['jumlah unduh'] || 0));
    if (urutanDaftar === 'like') return hasil.sort((a, b) => (b['jumlah like'] || 0) - (a['jumlah like'] || 0));
    if (urutanDaftar === 'nama') return hasil.sort((a, b) => String(a['nama file'] || '').localeCompare(String(b['nama file'] || ''), undefined, { sensitivity: 'base' }));
    // Terbaru: urutkan berdasarkan waktu terakhir diperbarui (edit > upload).
    return hasil.sort((a, b) => waktuTerbaru(b) - waktuTerbaru(a));
}
let timerPencarian = null;
function jadwalkanPencarian() {
    clearTimeout(timerPencarian);
    timerPencarian = setTimeout(terapkanFilterDanCari, 180);
}
function terapkanFilterDanCari() {
    const el = document.getElementById('kotak-cari');
    if (!el) return;
    const kunci = el.value.toLowerCase().trim();
    const hasil = daftarAddon.filter(item => {
        const nama = String(item['nama file'] || '').toLowerCase();
        const desc = String(item.description || '').toLowerCase();
        const tipe = String(item['type file'] || '').toLowerCase();
        const kat = String(item.kategori || 'lainnya').toLowerCase();
        const versi = String(item['versi mc'] || '').trim();
        const cocokKat = filterAktif === 'semua' || kat === filterAktif;
        const cocokKata = kunci === '' || nama.includes(kunci) || desc.includes(kunci) || tipe.includes(kunci) || versi.toLowerCase().includes(kunci) || kat.includes(kunci);
        return cocokKat && cocokKata;
    });
    // Pencarian + kategori sekarang mengubah bagian "Pilihan Addon" (atas).
    // "Semua Koleksi" tetap menampilkan katalog lengkap (ter-paginasi).
    const adaFilter = kunci !== '' || filterAktif !== 'semua';
    daftarTerfilter = adaFilter ? hasil : null;
    batasPilihanAddon = 8;
    tampilkanTopAddon();
    // Sentuh Semua Koleksi hanya saat status filter berubah (bukan tiap ketik).
    if (adaFilter !== filterSebelumnyaAktif) {
        filterSebelumnyaAktif = adaFilter;
        const judulKoleksi = document.querySelector('.daftar-addon .judul-bagian');
        if (judulKoleksi) judulKoleksi.innerHTML = '📁 Semua Koleksi';
        tampilkanDaftar(terapkanUrutan(daftarAddon));
    }
}
function salinLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        const notif = document.getElementById('notif-salin');
        notif.classList.add('tampil');
        setTimeout(() => notif.classList.remove('tampil'), 2500);
    });
}
// ==============================================
// NAVIGASI BAWAH — BERANDA / CARI / DISUKAI / PROFIL
// ==============================================
function aturNavigasiBawah() {
    document.querySelectorAll('.navigasi-bawah .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const nav = item.dataset.nav;
            if (nav === 'cari') {
                e.preventDefault();
                const input = document.getElementById('kotak-cari');
                if (input) {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => input.focus(), 350);
                } else {
                    window.location.href = 'index.html#kotak-cari';
                }
            }
            if (nav === 'disukai') {
                e.preventDefault();
                const disukai = ambilDaftarLikeLokal();
                filterAktif = 'semua';
                // Kembalikan Pilihan Addon ke tampilan normal saat buka menu Disukai.
                daftarTerfilter = null;
                filterSebelumnyaAktif = false;
                batasPilihanAddon = 8;
                tampilkanTopAddon();
                document.querySelectorAll('.btn-kategori').forEach(b => b.classList.remove('aktif'));
                document.querySelector('.btn-kategori[data-filter="semua"]')?.classList.add('aktif');
                const hasil = daftarAddon.filter(item => disukai.includes(item.slug));
                const judul = document.querySelector('.daftar-addon .judul-bagian');
                if (judul) judul.innerHTML = '👍 Addon Disukai';
                tampilkanDaftar(hasil);
                document.querySelector('.daftar-addon')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}
// ==============================================
// LONCENG NOTIFIKASI — badge merah + panel dropdown di header
// ==============================================
(function suntikCssNotifikasi() {
    if (document.getElementById('css-notifikasi-header')) return;
    const css = `
    .wadah-lonceng { position: relative; display: inline-flex; align-items: center; justify-content: center; }
    .badge-notif-header { position: absolute; top: -6px; right: -8px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #ff3b30; color: #fff; font-size: 11px; font-weight: 700; display: none; align-items: center; justify-content: center; line-height: 1; box-shadow: 0 0 0 2px #0d0d0d; z-index: 5; }
    .badge-notif-header.aktif { display: inline-flex; }
    .panel-notifikasi { position: fixed; z-index: 9999; width: min(360px, calc(100vw - 24px)); max-height: 70vh; background: #161616; border: 1px solid #2a2a2a; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.6); display: none; flex-direction: column; overflow: hidden; }
    .panel-notifikasi.terbuka { display: flex; }
    .panel-notifikasi-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #2a2a2a; }
    .panel-notifikasi-header strong { font-size: 14px; color: #fff; }
    .panel-notifikasi-header .panel-notifikasi-count { font-size: 12px; color: #ff3b30; font-weight: 700; }
    .panel-notifikasi-list { overflow-y: auto; flex: 1; }
    .panel-notifikasi-item { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 1px solid #222; cursor: pointer; transition: background .15s; }
    .panel-notifikasi-item:hover { background: #1f1f1f; }
    .panel-notifikasi-item.belum-dibaca { background: rgba(255,59,48,.06); }
    .panel-notifikasi-ikon { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 50%; background: #2a2a2a; display: flex; align-items: center; justify-content: center; color: #ff3b30; font-size: 14px; }
    .panel-notifikasi-isi { flex: 1; min-width: 0; }
    .panel-notifikasi-isi strong { display: block; font-size: 13px; color: #fff; margin-bottom: 2px; }
    .panel-notifikasi-isi p { margin: 0; font-size: 12px; color: #aaa; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .panel-notifikasi-waktu { font-size: 11px; color: #777; margin-top: 4px; }
    .panel-notifikasi-kosong { padding: 28px 16px; text-align: center; color: #888; font-size: 13px; }
    .panel-notifikasi-footer { padding: 10px 16px; border-top: 1px solid #2a2a2a; text-align: center; }
    .panel-notifikasi-footer a { color: #ff3b30; font-size: 13px; text-decoration: none; font-weight: 600; }
    `;
    const style = document.createElement('style');
    style.id = 'css-notifikasi-header';
    style.textContent = css;
    document.head.appendChild(style);
})();
let daftarNotifikasiHeader = [];
let panelNotifikasiEl = null;
let loncengEl = null;
let badgeNotifEl = null;
let timerPollNotifikasi = null;
function cariLonceng() {
    // Cari ikon lonceng (fa-bell) lalu ambil elemen klikabel induknya (button/a/div).
    const ikon = document.querySelector('i.fa-bell, i.fa-bell-o, [class*="fa-bell"]');
    if (!ikon) return null;
    let el = ikon;
    for (let i = 0; i < 4 && el.parentElement; i++) {
        el = el.parentElement;
        const tag = el.tagName;
        if (tag === 'BUTTON' || tag === 'A' || el.classList.contains('ikon-atas') || el.classList.contains('tombol-atas')) break;
    }
    return el;
}
function formatWaktuNotifikasi(ts) {
    if (!ts) return '';
    const detik = Math.floor((Date.now() - ts) / 1000);
    if (detik < 60) return 'baru saja';
    const menit = Math.floor(detik / 60);
    if (menit < 60) return `${menit} menit lalu`;
    const jam = Math.floor(menit / 60);
    if (jam < 24) return `${jam} jam lalu`;
    const hari = Math.floor(jam / 24);
    if (hari < 7) return `${hari} hari lalu`;
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function ikonUntukTipe(tipe) {
    if (tipe === 'balasan_komentar') return 'fa-reply';
    if (tipe === 'premium_renewal') return 'fa-refresh';
    if (tipe === 'premium_revoke') return 'fa-ban';
    return 'fa-bell';
}
async function muatNotifikasiHeader() {
    if (!penggunaLogin) { if (badgeNotifEl) { badgeNotifEl.classList.remove('aktif'); badgeNotifEl.textContent = ''; } return; }
    try {
        const token = await penggunaLogin.getIdToken();
        const respon = await fetch('/api/notifications?action=list', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
        });
        if (!respon.ok) return;
        const data = await respon.json();
        if (!data || !data.ok) return;
        daftarNotifikasiHeader = data.notifications || [];
        const belumDibaca = daftarNotifikasiHeader.filter(n => !n.dibaca).length;
        if (badgeNotifEl) {
            if (belumDibaca > 0) {
                badgeNotifEl.textContent = belumDibaca > 9 ? '9+' : String(belumDibaca);
                badgeNotifEl.classList.add('aktif');
            } else {
                badgeNotifEl.classList.remove('aktif');
                badgeNotifEl.textContent = '';
            }
        }
    } catch (_) { /* gagal? abaikan, tidak ganggu halaman */ }
}
function buatPanelNotifikasi() {
    panelNotifikasiEl = document.createElement('div');
    panelNotifikasiEl.className = 'panel-notifikasi';
    panelNotifikasiEl.innerHTML = `
        <div class="panel-notifikasi-header">
            <strong><i class="fa fa-bell"></i> Notifikasi</strong>
            <span class="panel-notifikasi-count"></span>
        </div>
        <div class="panel-notifikasi-list"></div>
        <div class="panel-notifikasi-footer"><a href="profil.html">Lihat semua di Profil</a></div>`;
    document.body.appendChild(panelNotifikasiEl);
    // Tutup saat klik di luar panel / lonceng.
    document.addEventListener('click', (e) => {
        if (!panelNotifikasiEl.classList.contains('terbuka')) return;
        if (panelNotifikasiEl.contains(e.target) || (loncengEl && loncengEl.contains(e.target))) return;
        tutupPanelNotifikasi();
    });
}
function posisikanPanel() {
    if (!panelNotifikasiEl || !loncengEl) return;
    const rect = loncengEl.getBoundingClientRect();
    const lebarPanel = panelNotifikasiEl.offsetWidth || 340;
    let kiri = rect.left + rect.width / 2 - lebarPanel / 2;
    kiri = Math.max(12, Math.min(kiri, window.innerWidth - lebarPanel - 12));
    const atas = Math.min(rect.bottom + 8, window.innerHeight - 100);
    panelNotifikasiEl.style.left = `${kiri}px`;
    panelNotifikasiEl.style.top = `${atas}px`;
}
function renderIsiPanel() {
    if (!panelNotifikasiEl) return;
    const list = panelNotifikasiEl.querySelector('.panel-notifikasi-list');
    const countEl = panelNotifikasiEl.querySelector('.panel-notifikasi-count');
    const belumDibaca = daftarNotifikasiHeader.filter(n => !n.dibaca).length;
    countEl.textContent = belumDibaca ? `${belumDibaca} baru` : 'Terbaru';
    if (!daftarNotifikasiHeader.length) {
        list.innerHTML = `<div class="panel-notifikasi-kosong"><i class="fa fa-bell-slash"></i><br>Belum ada notifikasi.</div>`;
        return;
    }
    list.innerHTML = daftarNotifikasiHeader.slice(0, 8).map(n => `
        <div class="panel-notifikasi-item ${n.dibaca ? '' : 'belum-dibaca'}" data-link="${n.link ? encodeURIComponent(n.link) : ''}">
            <div class="panel-notifikasi-ikon"><i class="fa ${ikonUntukTipe(n.tipe)}"></i></div>
            <div class="panel-notifikasi-isi">
                <strong>${n.judul}</strong>
                <p>${n.pesan}</p>
                <div class="panel-notifikasi-waktu">${formatWaktuNotifikasi(n.waktu)}</div>
            </div>
        </div>`).join('');
    list.querySelectorAll('.panel-notifikasi-item').forEach(item => {
        item.addEventListener('click', () => {
            const link = item.dataset.link;
            tutupPanelNotifikasi();
            if (link) window.location.href = decodeURIComponent(link);
        });
    });
}
async function bukaPanelNotifikasi() {
    if (!panelNotifikasiEl) buatPanelNotifikasi();
    renderIsiPanel();
    posisikanPanel();
    panelNotifikasiEl.classList.add('terbuka');
    // Tandai semua sudah dibaca saat panel dibuka, lalu refresh badge.
    if (penggunaLogin && daftarNotifikasiHeader.some(n => !n.dibaca)) {
        try {
            const token = await penggunaLogin.getIdToken();
            await fetch('/api/notifications?action=readAll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'readAll' })
            });
            daftarNotifikasiHeader.forEach(n => { n.dibaca = true; });
            if (badgeNotifEl) { badgeNotifEl.classList.remove('aktif'); badgeNotifEl.textContent = ''; }
            const countEl = panelNotifikasiEl?.querySelector('.panel-notifikasi-count');
            if (countEl) countEl.textContent = 'Terbaru';
        } catch (_) {}
    }
}
function tutupPanelNotifikasi() {
    panelNotifikasiEl?.classList.remove('terbuka');
}
function initLoncengNotifikasi() {
    loncengEl = cariLonceng();
    if (!loncengEl) return; // halaman tanpa lonceng (mis. profil) — lewati
    // Bungkus lonceng dengan wadah relatif untuk badge.
    const wadah = document.createElement('span');
    wadah.className = 'wadah-lonceng';
    badgeNotifEl = document.createElement('span');
    badgeNotifEl.className = 'badge-notif-header';
    loncengEl.parentNode.insertBefore(wadah, loncengEl);
    wadah.appendChild(loncengEl);
    wadah.appendChild(badgeNotifEl);
    loncengEl.addEventListener('click', (e) => {
        if (!penggunaLogin) return; // belum login → biarkan navigasi default (ke profil/login)
        e.preventDefault();
        e.stopPropagation();
        if (panelNotifikasiEl && panelNotifikasiEl.classList.contains('terbuka')) {
            tutupPanelNotifikasi();
        } else {
            muatNotifikasiHeader().then(bukaPanelNotifikasi);
        }
    });
    window.addEventListener('resize', () => { if (panelNotifikasiEl?.classList.contains('terbuka')) posisikanPanel(); });
    muatNotifikasiHeader();
    if (timerPollNotifikasi) clearInterval(timerPollNotifikasi);
    timerPollNotifikasi = setInterval(muatNotifikasiHeader, 60000); // refresh tiap 60 detik
}
// ==============================================
// MULAI SEMUA FUNGSI
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    tampilkanAddon();
    aturTabTopAddon();
    aturNavigasiBawah();
    initLoncengNotifikasi();
    document.getElementById('tombol-cari')?.addEventListener('click', terapkanFilterDanCari);
    document.getElementById('kotak-cari')?.addEventListener('input', jadwalkanPencarian);
    document.getElementById('kotak-cari')?.addEventListener('keydown', e => { if(e.key==='Enter') { clearTimeout(timerPencarian); terapkanFilterDanCari(); } });
    document.getElementById('filter-versi')?.addEventListener('change', e => {
        versiAktif = e.target.value === 'semua' ? 'semua' : decodeURIComponent(e.target.value);
        batasPilihanAddon = 8;
        tampilkanTopAddon();
    });
    document.getElementById('urutkan-addon')?.addEventListener('change', e => {
        urutanDaftar = e.target.value;
        batasPilihanAddon = 8;
        tampilkanTopAddon();
    });
});
