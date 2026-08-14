// ==============================================
// KONFIGURASI FIREBASE
// ==============================================
const firebaseConfig = {
  apiKey: "AIzaSyD9iPg5KJKlwEiTr7SMjAVTnca9XzGvv2M",
  authDomain: "share-addon.firebaseapp.com",
  databaseURL: "https://share-addon-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "share-addon",
  storageBucket: "share-addon.firebasestorage.app",
  messagingSenderId: "822096958816",
  appId: "1:822096958816:web:3a296039adf1ed861b3a05"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase, ref, get, set, increment } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let semuaDataAddon = {};
let daftarAddon = [];
let filterAktif = 'semua';

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

            // Gabungkan data dari Firebase ke setiap item
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
// TAMPILKAN TOP ADDON
// ==============================================
function tampilkanTopAddon() {
    const wadah = document.getElementById('wadah-top');
    if (!wadah || daftarAddon.length === 0) return;

    const terurut = [...daftarAddon].sort((a,b) => (b['jumlah unduh']||0) - (a['jumlah unduh']||0)).slice(0, 8);
    
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
                <div class="info-unduh"><i class="fa fa-download"></i> ${item['jumlah unduh'] || 0}</div>
            </div>
        `;
        kartu.addEventListener('click', () => window.location.href = `detail.html?slug=${item.slug}`);
        wadah.appendChild(kartu);
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
                        <button class="tombol-like ${sudahDiLike ? 'sudah' : ''}" data-slug="${item.slug}"><i class="fa fa-thumbs-up"></i> ${jumlahLike}</button>
                        <button class="tombol-bagi" data-link="${window.location.origin}${window.location.pathname.replace('index.html','')}${linkDetail}"><i class="fa fa-link"></i></button>
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

document.addEventListener('DOMContentLoaded', () => {
    tampilkanAddon();
    document.getElementById('tombol-cari')?.addEventListener('click', terapkanFilterDanCari);
    document.getElementById('kotak-cari')?.addEventListener('keydown', e => { if(e.key==='Enter') terapkanFilterDanCari(); });
});
