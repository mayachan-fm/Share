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
import { getDatabase, ref, get, increment, set, push, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
// ==============================================

let idAddonSekarang = null;

async function tampilkanDetail() {
    const wadah = document.getElementById('isi-detail');
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug'); // Baca slug dari URL

    if (!slug) {
        wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-exclamation-circle"></i><p>Addon tidak ditemukan</p></div>`;
        return;
    }

    try {
        const respon = await fetch('data.json');
        const data = await respon.json();

        // Cari addon berdasarkan slug
        const [idAddon, item] = Object.entries(data).find(([_, addon]) => addon.slug === slug) || [null, null];

        if (!item || !idAddon) {
            wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-exclamation-circle"></i><p>Data tidak ditemukan</p></div>`;
            return;
        }

        idAddonSekarang = idAddon; // Simpan ID untuk Firebase
        const linkDetail = window.location.href;
        let jumlahUnduh = item['jumlah unduh'] || 0;

        wadah.innerHTML = `
            <div class="kartu-detail">
                <img src="${item['link gambar']}" alt="${item['nama file']}" class="detail-gambar" onerror="this.src='https://via.placeholder.com/700x400/5D9C41/ffffff?text=${encodeURIComponent(item['nama file'])}'">
                <div class="detail-isi">
                    <div class="detail-judul">
                        <div>
                            <span class="tipe-file">${item['type file'] || 'File'}</span>
                            <h2>${item['nama file']}</h2>
                        </div>
                        <div class="detail-unduh">
                            <i class="fa fa-eye"></i>
                            <span>${jumlahUnduh} kali diunduh</span>
                        </div>
                    </div>

                    <div class="detail-info">
                        <div class="info-item"><span>Versi MC</span>${item['versi mc'] || 'Tidak diketahui'}</div>
                        <div class="info-item"><span>Ukuran</span>${item['ukuran'] || 'Tidak diketahui'}</div>
                        <div class="info-item"><span>Tanggal Unggah</span>${item['tanggal unggah'] || 'Tidak diketahui'}</div>
                    </div>

                    <div class="detail-deskripsi">${item.description}</div>

                    <div class="tombol-aksi">
                        <a href="${item['link download']}" target="_blank" class="tombol-unduh" data-id="${idAddonSekarang}">
                            <i class="fa fa-download"></i> Unduh File
                        </a>
                        <button class="tombol-bagi-detail" onclick="salinLink('${linkDetail}')" title="Salin Link">
                            <i class="fa fa-link"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Hitung unduh
        document.querySelector('.tombol-unduh').addEventListener('click', async () => {
            try {
                await set(ref(db, `jumlah_unduh/${idAddonSekarang}`), increment(1));
                jumlahUnduh++;
                document.querySelector('.detail-unduh span').textContent = `${jumlahUnduh} kali diunduh`;
            } catch (err) {
                console.error('Gagal menyimpan data unduh:', err);
            }
        });

        // === FUNGSI KOMENTAR ===
        siapkanKomentar();

    } catch (error) {
        wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-exclamation-triangle"></i><p>Gagal memuat data</p></div>`;
    }
}

function siapkanKomentar() {
    const inputKomen = document.getElementById('input-komentar');
    const tombolKirim = document.getElementById('tombol-kirim');
    const jumlahKarakter = document.getElementById('jumlah-karakter');

    // Hitung sisa karakter
    inputKomen.addEventListener('input', () => {
        jumlahKarakter.textContent = `${inputKomen.value.length}/300`;
    });

    // Kirim komentar
    tombolKirim.addEventListener('click', async () => {
        const isi = inputKomen.value.trim();
        if (!isi) return;

        try {
            await push(ref(db, `komentar/${idAddonSekarang}`), {
                isi: isi,
                waktu: Date.now()
            });
            inputKomen.value = '';
            jumlahKarakter.textContent = '0/300';
            tampilkanNotif('notif-komen');
        } catch (err) {
            console.error('Gagal kirim komentar:', err);
            alert('Gagal mengirim komentar, coba lagi nanti!');
        }
    });

    // Tampilkan komentar otomatis
    onValue(ref(db, `komentar/${idAddonSekarang}`), (snapshot) => {
        const daftar = document.getElementById('daftar-komentar');
        const data = snapshot.val();

        if (!data) {
            daftar.innerHTML = `<div class="pesan-kosong-komentar">Belum ada komentar, jadilah yang pertama!</div>`;
            return;
        }

        let html = '';
        const urutkan = Object.values(data).sort((a,b) => b.waktu - a.waktu);
        urutkan.forEach(komen => {
            const tgl = new Date(komen.waktu);
            const waktuTampil = `${tgl.getDate()} ${tgl.toLocaleString('id-ID', {month:'long'})} ${tgl.getFullYear()} pukul ${tgl.getHours().toString().padStart(2,'0')}:${tgl.getMinutes().toString().padStart(2,'0')}`;
            html += `
                <div class="isi-komentar">
                    <p class="teks-komentar">${komen.isi}</p>
                    <small class="waktu-komentar">${waktuTampil}</small>
                </div>
            `;
        });
        daftar.innerHTML = html;
    });
}

function tampilkanNotif(id) {
    const notif = document.getElementById(id);
    notif.classList.add('tampil');
    setTimeout(() => notif.classList.remove('tampil'), 2500);
}

function salinLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        tampilkanNotif('notif-salin');
    });
}

document.addEventListener('DOMContentLoaded', tampilkanDetail);
