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

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase, ref, get, set, increment } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let semuaDataAddon = {};
let daftarAddon = [];
let filterAktif = 'semua';
let modeTopAddon = 'terbanyak'; // Bawaan: Paling Banyak Diunduh

// ==============================================
// MUAT DATA AWAL
// ==============================================
async function tampilkanAddon() {
    const wadah = document.getElementById('wadah-addon');
    try {
        const respon = await fetch('./data.json');
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

        tampilkanTopAddon();
        wadah.innerHTML = '';
        tampilkanDaftar(daftarAddon);
        aturFilterKategori();
    } catch (error) {
        console.error("❌ Gagal memuat data:", error);
        wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-exclamation-triangle"></i><p>Belum bisa memuat data</p><span>Pastikan file data.json ada & formatnya benar</span><br><small>Detail: ${error.message}</small></div>`;
    }
}

// ==============================================
// TAMPILKAN TOP ADDON — DENGAN PILIHAN TAB
// ==============================================
function tampilkanTopAddon() {
    const wadah = document.getElementById('wadah-top');
    if (!wadah || daftarAddon.length === 0) return;

    let terurut;

    if (modeTopAddon === 'terbanyak') {
        // Urutkan: paling banyak diunduh
        terurut = [...daftarAddon]
            .sort((a, b) => (b['jumlah unduh'] || 0) - (a['jumlah unduh'] || 0))
            .slice(0, 8);
    } else {
        // ✅ OPSI 3: Yang paling bawah di data.json = paling baru diunggah
        terurut = [...daftarAddon].reverse().slice(0, 8);
    }

    wadah.innerHTML = '';
    terurut.forEach((item) => {
        const kartu = document.createElement('div');
        kartu.className = 'kartu-addon kartu-geser';
        kartu.dataset.kategori = item.kategori || 'lainnya';

        kartu.innerHTML = `
            <div class="gambar-wadah">
                <img src="${item['link gambar']}" alt="${item['nama file']}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x160/ff3b30/ffffff?text=Gambar+Tidak+Ada'">
            </div>
            <div class="kartu-isi">
                <h4>${item['nama file']}</h4>
                <div class="info-unduh">
                    <i class="fa ${modeTopAddon === 'terbanyak' ? 'fa-download' : 'fa-calendar'}"></i>
                    ${modeTopAddon === 'terbanyak' ? (item['jumlah unduh'] || 0) + ' unduhan' : item['tanggal unggah']}
                </div>
            </div>
        `;
        kartu.addEventListener('click', () => window.location.href = `detail.html?slug=${item.slug}`);
        wadah.appendChild(kartu);
    });
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
// TAMPILKAN DAFTAR UTAMA
// ==============================================
function tampilkanDaftar(dataYangDitampilkan) {
    const wadah = document.getElementById('wadah-addon');
    wadah.innerHTML = '';
    if (dataYangDitampilkan.length === 0) {
        wadah.innerHTML = `<div class="pesan-hilang"><i class="fa fa-search-minus"></i><p>Addon tidak ditemukan</p></div>`;
        return;
    }

    dataYangDitampilkan.forEach((item) => {
        const kartu = document.createElement('div');
        kartu.className = 'kartu-addon';
        kartu.dataset.kategori = item.kategori || 'lainnya';

        const tipeFile = item['type file'] ? `<span class="tipe-file">${item['type file']}</span>` : '';
        const linkDetail = `detail.html?slug=${item.slug}`;
        const sudahDiLike = JSON.parse(localStorage.getItem('sudahLike') || '[]').includes(item.slug);
        const jumlahLike = item['jumlah like'] || 0;

        kartu.innerHTML = `
            <div class="gambar-wadah">
                ${tipeFile}
                <img src="${item['link gambar']}" alt="${item['nama file']}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x180/ff3b30/ffffff?text=Gambar+Tidak+Ada'">
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
            const daftar = JSON.parse(localStorage.getItem('sudahLike') || '[]');
            if (!daftar.includes(slug)) {
                daftar.push(slug);
                localStorage.setItem('sudahLike', JSON.stringify(daftar));
                const idAddon = Object.keys(semuaDataAddon).find(k => semuaDataAddon[k].slug === slug);
                const refLike = ref(db, 'jumlah_like/' + idAddon);
                const snap = await get(refLike);
                const baru = (snap.exists()?snap.val():0) + 1;
                await set(refLike, baru);
                tombol.classList.add('sudah');
                tombol.querySelector('span').textContent = baru;
            }
        });
        wadah.appendChild(kartu);
    });
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

function terapkanFilterDanCari() {
    const el = document.getElementById('kotak-cari');
    if (!el) return;
    const kunci = el.value.toLowerCase().trim();
    const hasil = daftarAddon.filter(item => {
        const nama = (item['nama file']||'').toLowerCase();
        const desc = (item.description||'').toLowerCase();
        const tipe = (item['type file']||'').toLowerCase();
        const kat = (item.kategori||'lainnya');
        const cocokKat = filterAktif==='semua' || kat===filterAktif;
        const cocokKata = kunci==='' || nama.includes(kunci) || desc.includes(kunci) || tipe.includes(kunci);
        return cocokKat && cocokKata;
    });
    tampilkanDaftar(hasil);
}

function salinLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        const notif = document.getElementById('notif-salin');
        notif.classList.add('tampil');
        setTimeout(() => notif.classList.remove('tampil'), 2500);
    });
}

// ==============================================
// MULAI SEMUA FUNGSI
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    tampilkanAddon();
    aturTabTopAddon();
    document.getElementById('tombol-cari')?.addEventListener('click', terapkanFilterDanCari);
    document.getElementById('kotak-cari')?.addEventListener('keydown', e => { if(e.key==='Enter') terapkanFilterDanCari(); });
});
