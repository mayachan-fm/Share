const admin = require('firebase-admin');
const { catatAktivitas } = require('../lib/activity');

// === Konfigurasi GitHub untuk iklan.json (TIDAK menambah function API baru) ===
const OWNER = 'mayachan-fm';
const REPO = 'Share';
const IKLAN_PATH = 'iklan.json';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';
const MAKS_IKLAN = 20;
async function githubIklan(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { const e = new Error('GITHUB_TOKEN belum disetel di Vercel.'); e.status = 500; throw e; }
  const response = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/${path}`, { ...options, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(options.headers || {}) } });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch (_) { body = { message: text }; }
  if (!response.ok) { const e = new Error(body.message || `GitHub API error ${response.status}`); e.status = response.status; throw e; }
  return body;
}
// Turunkan ikon, warna, dan label otomatis dari jenis link (WA/YouTube/TikTok/dll).
function derivasiTampilanIklan(link) {
  const u = String(link || '').toLowerCase();
  if (u.includes('wa.me') || u.includes('whatsapp.com')) return { label: 'Channel WhatsApp', ikon: 'fa-whatsapp', warna: '#25D366' };
  if (u.includes('tiktok.com')) return { label: 'Akun TikTok', ikon: 'fa-music', warna: '#fe2c55' };
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { label: 'Channel YouTube', ikon: 'fa-youtube-play', warna: '#ff0000' };
  if (u.includes('discord.gg') || u.includes('discord.com')) return { label: 'Grup Discord', ikon: 'fa-users', warna: '#5865F2' };
  if (u.includes('t.me') || u.includes('telegram')) return { label: 'Channel Telegram', ikon: 'fa-paper-plane', warna: '#229ED9' };
  if (u.includes('instagram.com')) return { label: 'Akun Instagram', ikon: 'fa-instagram', warna: '#E1306C' };
  if (u.includes('facebook.com') || u.includes('fb.com')) return { label: 'Halaman Facebook', ikon: 'fa-facebook', warna: '#1877F2' };
  return { label: 'Channel / Promo', ikon: 'fa-bullhorn', warna: '#ff3b30' };
}
function idIklan() { return 'ik_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
// Id deterministik untuk item lama yang belum punya id (berdasarkan nama + link, agar tidak pernah duplikat).
function idIklanLama(nama, link) { return 'ik_' + Buffer.from(String(nama || '') + '|' + String(link || '')).toString('base64url').slice(0, 12); }
// Baca iklan.json dari GitHub, normalisasi jadi array + pastikan tiap item punya id (item lama tanpa id diberi id otomatis).
async function bacaIklanNormal() {
  let current;
  try {
    current = await githubIklan(`contents/${IKLAN_PATH}?ref=${encodeURIComponent(BRANCH)}`);
  } catch (e) {
    if (Number(e.status) === 404) return { list: [], sha: null };
    throw e;
  }
  if (!current.content || current.encoding !== 'base64') throw new Error('GitHub tidak mengembalikan isi iklan.json yang bisa dibaca.');
  const jsonText = Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8').trim() || '[]';
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch (_) { throw new Error('iklan.json di GitHub bukan JSON yang valid.'); }
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed && parsed.iklan) ? parsed.iklan : []);
  const list = arr.map(item => {
    const it = (item && typeof item === 'object') ? item : {};
    const turunan = derivasiTampilanIklan(it.link);
    return {
      id: String(it.id || idIklanLama(it.nama, it.link)),
      nama: String(it.nama || '').trim(),
      deskripsi: String(it.deskripsi || '').trim(),
      link: String(it.link || '').trim(),
      label: String(it.label || turunan.label),
      ikon: String(it.ikon || turunan.ikon),
      warna: String(it.warna || turunan.warna)
    };
  }).filter(it => it.nama && it.link);
  return { list, sha: current.sha };
}
async function tulisIklan(list, sha, pesanCommit) {
  const encoded = Buffer.from(JSON.stringify(list, null, 2) + '\n', 'utf8').toString('base64');
  const payload = { message: pesanCommit.slice(0, 200), content: encoded, branch: BRANCH };
  if (sha) payload.sha = sha;
  return githubIklan(`contents/${IKLAN_PATH}`, { method: 'PUT', body: JSON.stringify(payload) });
}

function send(res, status, body) { res.status(status).json(body); }

function getFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey || !process.env.FIREBASE_DATABASE_URL) {
    throw new Error('Konfigurasi Firebase Admin di Vercel belum lengkap.');
  }
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

async function verifyOwner(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const e = new Error('Login diperlukan.'); e.status = 401; throw e;
  }
  const decoded = await admin.auth().verifyIdToken(authHeader.slice(7).trim());
  const snap = await admin.database().ref(`roles/${decoded.uid}`).once('value');
  if (String(snap.val() || '').toLowerCase() !== 'owner') {
    const e = new Error('Hanya Owner yang boleh mengelola Premium.'); e.status = 403; throw e;
  }
  return decoded;
}

async function resolveUser(value) {
  const lookup = String(value || '').trim();
  if (!lookup) throw new Error('Masukkan email atau username akun.');
  if (lookup.includes('@')) return admin.auth().getUserByEmail(lookup.toLowerCase());
  return admin.auth().getUserByEmail(`${lookup.toLowerCase()}@mcaddon-6c691.firebaseapp.com`);
}

function statusOf(data, now = Date.now()) {
  if (!data || typeof data !== 'object') return { aktif: false, kadaluarsa: false, dicabut: false };
  const revoked = Number(data.dicabutPada) > 0;
  const permanent = String(data.tipe || '').toLowerCase() === 'permanen' || data.berakhir == null;
  const expired = !permanent && Number(data.berakhir) <= now;
  return { aktif: !revoked && !expired, kadaluarsa: expired, dicabut: revoked, sisaMs: (!revoked && !expired && !permanent) ? Math.max(0, Number(data.berakhir) - now) : null };
}


async function buatNotifikasi(uid, payload) {
  const ref = admin.database().ref(`notifikasi/${uid}`).push();
  await ref.set({
    tipe: String(payload?.tipe || 'info'),
    judul: String(payload?.judul || 'Notifikasi'),
    pesan: String(payload?.pesan || ''),
    waktu: Number(payload?.waktu) || Date.now(),
    dibaca: false
  });
}

async function buildPremiumList() {
  const snap = await admin.database().ref('premium').once('value');
  const raw = snap.val();
  if (!raw || typeof raw !== 'object') return [];
  const now = Date.now();
  const entries = [];
  for (const [uid, data] of Object.entries(raw)) {
    try {
      const user = await admin.auth().getUser(uid);
      const status = statusOf(data, now);
      entries.push({
        uid,
        email: user.email || '',
        tipe: data?.tipe || null,
        mulai: data?.mulai || null,
        berakhir: data?.berakhir ?? null,
        dicabutPada: data?.dicabutPada || null,
        aktif: status.aktif,
        kadaluarsa: status.kadaluarsa,
        dicabut: status.dicabut
      });
    } catch (_) {
      entries.push({uid, email:'', tipe:data?.tipe || null, mulai:data?.mulai || null, berakhir:data?.berakhir ?? null, dicabutPada:data?.dicabutPada || null, ...statusOf(data, now)});
    }
  }
  return entries.sort((a,b) => Number(b.mulai || 0) - Number(a.mulai || 0));
}


async function buildPremiumHistory(limit = 100) {
  const snap = await admin.database().ref('premium_history').once('value');
  const raw = snap.val();
  if (!raw || typeof raw !== 'object') return [];
  const rows = Object.entries(raw).map(([id, item]) => ({
    id,
    uid: item?.uid || '',
    email: item?.email || '',
    aksi: item?.aksi || 'unknown',
    durasi: item?.durasi || null,
    waktu: item?.waktu || null,
    sebelumnyaBerakhir: item?.sebelumnyaBerakhir ?? null,
    berakhir: item?.berakhir ?? null,
    renewal: !!item?.renewal,
    dicabutPada: item?.dicabutPada ?? null,
    dilakukanOleh: item?.dilakukanOleh || '',
    dilakukanOlehEmail: item?.dilakukanOlehEmail || ''
  }));
  rows.sort((a, b) => Number(b.waktu || 0) - Number(a.waktu || 0));
  return rows.slice(0, Math.max(1, Math.min(Number(limit) || 100, 200)));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, {ok:false, error:'Method tidak diizinkan.'});
  try {
    getFirebaseAdmin();
    const owner = await verifyOwner(req);
    const action = String(req.body?.action || '').trim();
    const db = admin.database();

    if (action === 'list') return send(res, 200, {ok:true, premium: await buildPremiumList(), history: await buildPremiumHistory(100)});

    if (action === 'grant') {
      const target = await resolveUser(req.body?.identifier);
      const duration = String(req.body?.duration || '').trim().toLowerCase();
      const days = { '7_hari':7, '30_hari':30, '90_hari':90 };
      if (!days[duration] && duration !== 'permanen') return send(res, 400, {ok:false,error:'Durasi Premium tidak valid.'});
      if (target.uid === owner.uid) return send(res, 400, {ok:false,error:'Gunakan akun Premium target, bukan akun Owner.'});
      const mulai = Date.now();
      const premiumRef = db.ref(`premium/${target.uid}`);
      const currentSnap = await premiumRef.once('value');
      const current = currentSnap.exists() && currentSnap.val() && typeof currentSnap.val() === 'object' ? currentSnap.val() : null;
      const currentTipe = String(current?.tipe || '').toLowerCase();
      const currentBerakhir = current?.berakhir == null ? null : Number(current.berakhir);
      const currentDicabut = Number(current?.dicabutPada) > 0;
      const currentPermanent = current && !currentDicabut && (currentTipe === 'permanen' || currentBerakhir == null);

      let berakhir = null;
      let renewal = false;
      if (duration === 'permanen') {
        // Permanent Premium stays permanent even when granted again.
        berakhir = null;
        renewal = !!currentPermanent;
      } else {
        const tambahanMs = days[duration] * 24 * 60 * 60 * 1000;
        // If the current Premium is still active, add the new duration to its
        // existing expiry. If it is expired/revoked/nonexistent, start from now.
        if (current && !currentDicabut && !currentPermanent && Number.isFinite(currentBerakhir) && currentBerakhir > mulai) {
          berakhir = currentBerakhir + tambahanMs;
          renewal = true;
        } else {
          berakhir = mulai + tambahanMs;
        }
      }

      const payload = {
        tipe: duration,
        mulai: renewal && current?.mulai ? current.mulai : mulai,
        berakhir,
        dicabutPada: null,
        diberikanOleh: owner.uid
      };
      const historyRef = db.ref('premium_history').push();
      const targetEmail = target.email || target.uid;
      const historyPayload = {
        uid: target.uid,
        email: targetEmail,
        aksi: renewal ? 'renewal' : 'grant',
        durasi: duration,
        waktu: mulai,
        sebelumnyaBerakhir: current?.berakhir ?? null,
        berakhir,
        renewal,
        dicabutPada: null,
        dilakukanOleh: owner.uid,
        dilakukanOlehEmail: owner.email || owner.uid
      };
      const updates = {};
      updates[`premium/${target.uid}`] = payload;
      updates[`premium_history/${historyRef.key}`] = historyPayload;
      await db.ref().update(updates);
      const waktuBerakhir = berakhir ? new Date(berakhir).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' }) : 'tidak berakhir';
      await buatNotifikasi(target.uid, {
        tipe: renewal ? 'premium_renewal' : 'premium_grant',
        judul: renewal ? 'Premium diperpanjang' : 'Premium diberikan',
        pesan: renewal
          ? `Premium kamu diperpanjang ${duration.replace('_', ' ')}. Masa aktif berakhir ${waktuBerakhir}.`
          : `Kamu mendapatkan Premium ${duration.replace('_', ' ')}. Masa aktif berakhir ${waktuBerakhir}.`,
        waktu: mulai
      });
      const actionLabel = renewal ? `Memperpanjang Premium ${duration}` : `Memberikan Premium ${duration}`;
      await catatAktivitas({decoded:owner, role:'owner', aksi:'premium_beri', targetId:target.uid, targetName:target.email || target.uid, detail:actionLabel});
      return send(res, 200, {
        ok:true,
        renewal,
        message: renewal
          ? `Premium ${duration} berhasil ditambahkan ke Premium yang masih aktif milik ${target.email || 'akun tersebut'}.`
          : `Premium ${duration} berhasil diberikan kepada ${target.email || 'akun tersebut'}.`
      });
    }

    if (action === 'revoke') {
      const uid = String(req.body?.uid || '').trim();
      if (!uid) return send(res, 400, {ok:false,error:'UID Premium tidak diberikan.'});
      if (uid === owner.uid) return send(res, 400, {ok:false,error:'Owner tidak dapat mencabut akses dirinya sendiri.'});
      const ref = db.ref(`premium/${uid}`);
      const snap = await ref.once('value');
      if (!snap.exists()) return send(res, 404, {ok:false,error:'Data Premium tidak ditemukan.'});
      const current = snap.val() || {};
      const dicabutPada = Date.now();
      let targetEmail = uid;
      try { targetEmail = (await admin.auth().getUser(uid)).email || uid; } catch (_) {}
      const historyRef = db.ref('premium_history').push();
      const historyPayload = {
        uid,
        email: targetEmail,
        aksi: 'revoke',
        durasi: current?.tipe || null,
        waktu: dicabutPada,
        sebelumnyaBerakhir: current?.berakhir ?? null,
        berakhir: current?.berakhir ?? null,
        renewal: false,
        dicabutPada,
        dilakukanOleh: owner.uid,
        dilakukanOlehEmail: owner.email || owner.uid
      };
      const updates = {};
      updates[`premium/${uid}/dicabutPada`] = dicabutPada;
      updates[`premium_history/${historyRef.key}`] = historyPayload;
      await db.ref().update(updates);
      await buatNotifikasi(uid, {
        tipe: 'premium_revoke',
        judul: 'Premium dicabut',
        pesan: 'Akses Premium akun kamu telah dicabut oleh Owner.',
        waktu: dicabutPada
      });
      await catatAktivitas({decoded:owner, role:'owner', aksi:'premium_cabut', targetId:uid, targetName:targetEmail, detail:'Mencabut akses Premium'});
      return send(res, 200, {ok:true,message:`Premium ${targetEmail} berhasil dicabut.`});
    }

    // === Kelola Iklan / Promosi — disimpan di iklan.json (dibaca frontend langsung sebagai file static). ===
    if (action === 'iklan_list') {
      const { list } = await bacaIklanNormal();
      return send(res, 200, { ok: true, iklan: list });
    }
    if (action === 'iklan_tambah') {
      const nama = String(req.body?.nama || '').trim();
      const deskripsi = String(req.body?.deskripsi || '').trim();
      const link = String(req.body?.link || '').trim();
      if (!nama || nama.length > 80) return send(res, 400, { ok: false, error: 'Nama channel wajib diisi (maks. 80 karakter).' });
      if (!deskripsi || deskripsi.length > 300) return send(res, 400, { ok: false, error: 'Deskripsi wajib diisi (maks. 300 karakter).' });
      let linkBersih = link;
      try { const u = new URL(link); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); linkBersih = u.href; } catch (_) { return send(res, 400, { ok: false, error: 'Link harus diawali https:// yang valid.' }); }
      const { list, sha } = await bacaIklanNormal();
      if (list.length >= MAKS_IKLAN) return send(res, 400, { ok: false, error: `Maksimal ${MAKS_IKLAN} iklan. Hapus salah satu dulu.` });
      const turunan = derivasiTampilanIklan(linkBersih);
      const item = { id: idIklan(), nama, deskripsi, link: linkBersih, label: turunan.label, ikon: turunan.ikon, warna: turunan.warna, ditambahkan: Date.now() };
      list.push(item);
      await tulisIklan(list, sha, `Tambah iklan: ${nama}`);
      await catatAktivitas({ decoded: owner, role: 'owner', aksi: 'iklan_tambah', targetId: item.id, targetName: nama, detail: 'Menambahkan iklan/promosi ke iklan.json' });
      return send(res, 200, { ok: true, message: `Iklan "${nama}" berhasil ditambahkan.`, iklan: list });
    }
    if (action === 'iklan_hapus') {
      const id = String(req.body?.id || '').trim();
      if (!id) return send(res, 400, { ok: false, error: 'ID iklan tidak diberikan.' });
      const { list, sha } = await bacaIklanNormal();
      const indeks = list.findIndex(it => it.id === id);
      if (indeks === -1) return send(res, 404, { ok: false, error: 'Iklan tidak ditemukan.' });
      const terhapus = list[indeks];
      list.splice(indeks, 1);
      await tulisIklan(list, sha, `Hapus iklan: ${terhapus.nama}`);
      await catatAktivitas({ decoded: owner, role: 'owner', aksi: 'iklan_hapus', targetId: id, targetName: terhapus.nama, detail: 'Menghapus iklan/promosi dari iklan.json' });
      return send(res, 200, { ok: true, message: `Iklan "${terhapus.nama}" berhasil dihapus.`, iklan: list });
    }

    return send(res, 400, {ok:false,error:'Aksi tidak dikenal.'});
  } catch (error) {
    console.error('manage-premium error:', error);
    let status = Number(error.status) || 500;
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') status = 401;
    if (error.code === 'auth/user-not-found') status = 404;
    return send(res, status, {ok:false,error:error.message || 'Gagal mengelola Premium.'});
  }
};
