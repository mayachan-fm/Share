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
import { getDatabase, ref, get, increment, set, push, onValue } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const app = getApp();
const db = getDatabase(app);

let usuarioActual = null;
let authResuelta = false;

onAuthStateChanged(auth, (user) => {
    usuarioActual = user;
    authResuelta = true;
    actualizarAksesKomentar();
});

function actualizarAksesKomentar() {
    const form = document.querySelector(".form-komentar");
    if (!form) return;
    if (usuarioActual) {
        if (form.dataset.ready === "1") return;
        form.dataset.ready = "1";
        form.innerHTML = `
            <textarea id="input-komentar" placeholder="Tulis komentarmu disini..." maxlength="300"></textarea>
            <div class="batas-karakter">
                <span id="jumlah-karakter">0/300</span>
                <button id="tombol-kirim" class="tombol-unduh">Kirim</button>
            </div>`;
        siapkanInputKomentar();
    } else {
        form.dataset.ready = "0";
        form.innerHTML = `
            <div class="kartu-login-komentar">
                <i class="fa fa-lock"></i>
                <strong>Login diperlukan</strong>
                <p>Silakan login atau daftar terlebih dahulu untuk menulis komentar.</p>
                <a href="profil.html" class="tombol-utama">Login / Daftar</a>
            </div>`;
    }
}

function siapkanInputKomentar() {
    const input = document.getElementById("input-komentar");
    const jumlah = document.getElementById("jumlah-karakter");
    if (!input || !jumlah) return;
    input.addEventListener("input", () => jumlah.textContent = `${input.value.length}/300`);
}
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
        if (!respon.ok) throw new Error('Gagal memuat data.json');
        const data = await respon.json();

        // Cari addon berdasarkan slug
        const [idAddon, item] = Object.entries(data).find(([_, addon]) => addon.slug === slug) || [null, null];

        if (!item || !idAddon) {
            wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-exclamation-circle"></i><p>Data tidak ditemukan</p></div>`;
            return;
        }

        idAddonSekarang = idAddon; // Simpan ID untuk Firebase
        const linkDetail = window.location.href;
        
        // Ambil jumlah unduh dari Firebase, bukan dari JSON
        const snapUnduh = await get(ref(db, `jumlah_unduh/${idAddon}`));
        let jumlahUnduh = snapUnduh.exists() ? snapUnduh.val() : 0;

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

                    <div class="detail-deskripsi">${item.description || 'Tidak ada deskripsi.'}</div>

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

        // Hitung unduh — hanya sekali per klik
        document.querySelector('.tombol-unduh').addEventListener('click', async () => {
            try {
                const refUnduh = ref(db, `jumlah_unduh/${idAddonSekarang}`);
                await set(refUnduh, increment(1));
                jumlahUnduh++;
                document.querySelector('.detail-unduh span').textContent = `${jumlahUnduh} kali diunduh`;
            } catch (err) {
                console.error('Gagal menyimpan data unduh:', err);
                alert('Gagal memperbarui jumlah unduh!');
            }
        });

        // === FUNGSI KOMENTAR ===
        siapkanKomentar();

    } catch (error) {
        console.error('Error memuat detail:', error);
        wadah.innerHTML = `<div class="pesan-kosong"><i class="fa fa-exclamation-triangle"></i><p>Gagal memuat data</p></div>`;
    }
}

function siapkanKomentar() {
    const form = document.querySelector(".form-komentar");
    if (!form) return;
    actualizarAksesKomentarFallback();
    mulaiPantauKomentar();
}

function mulaiPantauKomentar() {
    if (!idAddonSekarang) return;
    const daftar = document.getElementById('daftar-komentar');
    if (!daftar) return;

    const komentarRef = ref(db, `komentar/${idAddonSekarang}`);

    onValue(komentarRef, (snapshot) => {
        if (!snapshot.exists()) {
            daftar.innerHTML = `<div class="pesan-kosong-komentar">Belum ada komentar, jadilah yang pertama!</div>`;
            return;
        }

        const semua = [];
        snapshot.forEach((child) => {
            const data = child.val() || {};
            semua.push({
                id: child.key,
                isi: data.isi || '',
                waktu: Number(data.waktu) || 0,
                username: data.username || 'Pengguna'
            });
        });

        // Komentar terbaru ditampilkan paling atas.
        semua.sort((a, b) => b.waktu - a.waktu);

        daftar.innerHTML = semua.map((komen) => {
            const nama = escapeHtml(komen.username);
            const isi = escapeHtml(komen.isi);
            const waktu = formatWaktuKomentar(komen.waktu);

            return `
                <div class="item-komentar" data-id="${escapeHtml(komen.id)}">
                    <div class="komentar-kepala">
                        <strong>@${nama}</strong>
                        <span>${waktu}</span>
                    </div>
                    <div class="komentar-isi">${isi}</div>
                </div>
            `;
        }).join('');
    }, (error) => {
        console.error('Gagal memuat komentar:', error);
        daftar.innerHTML = `<div class="pesan-kosong-komentar">Komentar tidak dapat dimuat.</div>`;
    });
}

function formatWaktuKomentar(timestamp) {
    if (!timestamp) return 'baru saja';

    const selisih = Math.max(0, Date.now() - timestamp);
    const detik = Math.floor(selisih / 1000);

    if (detik < 60) return 'baru saja';

    const menit = Math.floor(detik / 60);
    if (menit < 60) return `${menit} menit lalu`;

    const jam = Math.floor(menit / 60);
    if (jam < 24) return `${jam} jam lalu`;

    const hari = Math.floor(jam / 24);
    if (hari < 30) return `${hari} hari lalu`;

    return new Date(timestamp).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function actualizarAksesKomentarFallback() {
    if (!authResuelta) return;
    actualizarAksesKomentar();
    if (!usuarioActual) return;

    const tombolKirim = document.getElementById('tombol-kirim');
    const inputKomen = document.getElementById('input-komentar');
    const jumlahKarakter = document.getElementById('jumlah-karakter');
    if (!inputKomen || !tombolKirim || !jumlahKarakter) return;

    tombolKirim.addEventListener('click', async () => {
        const isi = inputKomen.value.trim();
        if (!isi || isi.length > 300) return;
        if (!idAddonSekarang) { alert('ID addon tidak ditemukan!'); return; }
        if (!usuarioActual) { actualizarAksesKomentar(); return; }
        try {
            await push(ref(db, `komentar/${idAddonSekarang}`), {
                isi: isi,
                waktu: Date.now(),
                uid: usuarioActual.uid,
                username: usuarioActual.email ? usuarioActual.email.split('@')[0] : 'Pengguna'
            });
            inputKomen.value = '';
            jumlahKarakter.textContent = '0/300';
            tampilkanNotif('notif-komen');
        } catch (err) {
            console.error('Gagal kirim komentar:', err);
            alert('Gagal mengirim komentar, coba lagi nanti!');
        }
    });
}

// Cegah XSS — bersihkan teks komentar
function escapeHtml(teks) {
    const div = document.createElement('div');
    div.textContent = teks;
    return div.innerHTML;
}

function tampilkanNotif(id) {
    const notif = document.getElementById(id);
    if (!notif) return;
    notif.classList.add('tampil');
    setTimeout(() => notif.classList.remove('tampil'), 2500);
}

window.salinLink = function(link) {
    navigator.clipboard.writeText(link)
        .then(() => tampilkanNotif('notif-salin'))
        .catch(() => alert('Gagal menyalin link!'));
};

document.addEventListener('DOMContentLoaded', tampilkanDetail);
