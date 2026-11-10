const admin = require('firebase-admin');
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
async function verifyUser(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const e = new Error('Login diperlukan.'); e.status = 401; throw e;
  }
  return admin.auth().verifyIdToken(authHeader.slice(7).trim());
}
module.exports = async (req, res) => {
  try {
    getFirebaseAdmin();
    const user = await verifyUser(req);
    const db = admin.database();
    const action = String(req.body?.action || req.query?.action || 'list').trim();
    const clean = (v, max) => String(v ?? '').trim().slice(0, max);

    // ============================================================
    // action=create — buat notifikasi untuk user lain (mis. balasan komentar).
    // Server-side agar tidak terblokir aturan keamanan RTDB (notifikasi/{uid}
    // hanya boleh ditulis pemiliknya). Dipanggil dari detail.js saat membalas.
    // ============================================================
    if (action === 'create') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const targetUid = clean(body.targetUid, 180);
      const tipe = clean(body.tipe || 'info', 40) || 'info';
      const judul = clean(body.judul, 120);
      const pesan = clean(body.pesan, 300);
      const link = clean(body.link, 200);
      if (!targetUid || !judul || !pesan) {
        return send(res, 400, { ok: false, error: 'Data notifikasi tidak lengkap.' });
      }
      if (targetUid === user.uid) {
        return send(res, 200, { ok: true, skipped: true, alasan: 'Tidak perlu notifikasi ke diri sendiri.' });
      }
      // Rate limit sederhana: max 1 notifikasi per 5 detik per pengirim (anti-spam).
      const rateRef = db.ref(`batas_notif/${user.uid}`);
      const now = Date.now();
      const rate = await rateRef.once('value');
      const terakhir = Number(rate.val()) || 0;
      if (now - terakhir < 5000) {
        return send(res, 429, { ok: false, error: 'Terlalu cepat. Tunggu beberapa detik lagi.' });
      }
      const notifRef = db.ref(`notifikasi/${targetUid}`).push();
      await notifRef.set({
        id: notifRef.key,
        tipe,
        judul,
        pesan,
        link,
        waktu: now,
        dibaca: false
      });
      await rateRef.set(now);
      return send(res, 201, { ok: true, id: notifRef.key });
    }

    // Report actions share this function to stay within the Vercel Hobby function limit.
    if (action === 'report') {
      const userSnap = await db.ref(`roles/${user.uid}`).once('value');
      const role = String(userSnap.val() || 'user').toLowerCase();
      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const slug = clean(body.slug, 120);
        const reason = clean(body.reason, 80);
        const message = clean(body.message, 800);
        if (!slug || !reason || message.length < 10) {
          return send(res, 400, { ok: false, error: 'Pilih alasan dan tulis pesan minimal 10 karakter (maksimal 800).' });
        }
        // Nama addon dikirim dari client (detail.js) agar tidak perlu self-fetch ke /api/catalog
        // yang memicu cold-start bertingkat dan sering timeout di Vercel Hobby (batas 10 detik).
        const namaAddon = clean(body.namaAddon || slug, 180);
        const rateRef = db.ref(`batas_laporan/${user.uid}/${slug}`);
        const now = Date.now();
        const rate = await rateRef.once('value');
        if (rate.exists() && now - Number(rate.val()) < 10 * 60 * 1000) {
          return send(res, 429, { ok: false, error: 'Kamu baru saja melaporkan addon ini. Coba lagi dalam 10 menit.' });
        }
        const reportRef = db.ref('laporan').push();
        await reportRef.set({
          id: reportRef.key,
          slug,
          namaAddon,
          reason,
          message,
          uid: user.uid,
          username: clean(user.name || user.email?.split('@')[0] || 'Pengguna', 80),
          email: clean(user.email || '', 160),
          waktu: now,
          status: 'belum_ditinjau'
        });
        await rateRef.set(now);
        return send(res, 201, { ok: true, message: 'Laporan berhasil dikirim.' });
      }
      if (role !== 'owner') return send(res, 403, { ok: false, error: 'Hanya Owner yang dapat mengelola laporan.' });
      if (req.method === 'GET') {
        const snap = await db.ref('laporan').orderByChild('waktu').limitToLast(300).once('value');
        const reports = Object.entries(snap.val() || {}).map(([id, item]) => ({ id, ...item }))
          .sort((a, b) => (Number(b.waktu) || 0) - (Number(a.waktu) || 0));
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 200, { ok: true, reports });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = clean(body.id, 180);
      if (!id || id.includes('/')) return send(res, 400, { ok: false, error: 'ID laporan tidak valid.' });
      const ref = db.ref(`laporan/${id}`);
      const snap = await ref.once('value');
      if (!snap.exists()) return send(res, 404, { ok: false, error: 'Laporan tidak ditemukan.' });
      if (req.method === 'DELETE') {
        await ref.remove();
        return send(res, 200, { ok: true, message: 'Laporan dihapus.' });
      }
      if (req.method === 'PATCH') {
        const status = clean(body.status, 30);
        if (!['belum_ditinjau', 'sedang_diperiksa', 'selesai'].includes(status)) {
          return send(res, 400, { ok: false, error: 'Status laporan tidak valid.' });
        }
        await ref.update({ status, ditinjauOleh: user.uid, diubahPada: Date.now() });
        return send(res, 200, { ok: true, message: 'Status laporan diperbarui.' });
      }
      return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
    }
    // ============================================================
    // action=broadcast — Owner mengirim pengumuman ke SEMUA pengguna.
    // Server menulis notifikasi ke node notifikasi/{uid} setiap akun
    // (fan-out) agar sistem notifikasi existing (polling + panel)
    // menampilkannya tanpa perubahan frontend. Tidak menambah file API
    // baru (batas Vercel Hobby sudah penuh).
    // ============================================================
    if (action === 'broadcast') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
      const roleSnap = await db.ref(`roles/${user.uid}`).once('value');
      if (String(roleSnap.val() || 'user').toLowerCase() !== 'owner') {
        return send(res, 403, { ok: false, error: 'Hanya Owner yang dapat mengirim pengumuman.' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const pesan = clean(body.pesan, 500);
      if (pesan.length < 5) {
        return send(res, 400, { ok: false, error: 'Pesan pengumuman minimal 5 karakter (maksimal 500).' });
      }
      const judul = clean(body.judul || 'Pengumuman dari Owner', 120) || 'Pengumuman dari Owner';
      // Rate limit: maksimal 1 pengumuman per 60 detik (anti double-kirim).
      const rateRef = db.ref(`batas_pengumuman/${user.uid}`);
      const now = Date.now();
      const rate = Number((await rateRef.once('value')).val()) || 0;
      if (now - rate < 60 * 1000) {
        return send(res, 429, { ok: false, error: 'Baru saja mengirim pengumuman. Tunggu 60 detik lagi.' });
      }
      // Ambil semua UID akun Firebase Auth (paginate, aman sampai ribuan akun).
      const uids = [];
      let pageToken;
      do {
        const listResult = await admin.auth().listUsers(1000, pageToken);
        listResult.users.forEach(u => uids.push(u.uid));
        pageToken = listResult.pageToken;
      } while (pageToken);
      if (!uids.length) return send(res, 200, { ok: true, message: 'Tidak ada pengguna terdaftar.', terkirim: 0 });
      // Fan-out: satu multi-path update untuk semua pengguna (cepat, 1 request).
      const notif = { tipe: 'pengumuman', judul, pesan, waktu: now, dibaca: false };
      const updates = {};
      uids.forEach(uid => {
        const key = db.ref().push().key;
        updates[`notifikasi/${uid}/${key}`] = notif;
      });
      await db.ref().update(updates);
      await rateRef.set(now);
      // Arsip pengumuman (dibaca owner panel sebagai riwayat).
      const arcRef = db.ref('pengumuman').push();
      await arcRef.set({
        id: arcRef.key,
        judul,
        pesan,
        waktu: now,
        oleh: user.uid,
        olehEmail: clean(user.email || '', 160),
        terkirim: uids.length
      });
      return send(res, 200, { ok: true, message: `Pengumuman terkirim ke ${uids.length} pengguna.`, terkirim: uids.length });
    }
    // ============================================================
    // action=history — Owner melihat arsip pengumuman (riwayat).
    // Dibaca server-side karena node `pengumuman` tidak boleh dibaca
    // langsung dari client (aturan RTDB menolak → "Permission denied"
    // di Panel Owner). Tidak menambah file API baru (batas Vercel Hobby
    // sudah penuh) — digabung di notifications.js yang sama.
    // ============================================================
    if (action === 'history') {
      if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
      const roleSnap = await db.ref(`roles/${user.uid}`).once('value');
      if (String(roleSnap.val() || 'user').toLowerCase() !== 'owner') {
        return send(res, 403, { ok: false, error: 'Hanya Owner yang dapat melihat riwayat pengumuman.' });
      }
      const snap = await db.ref('pengumuman').once('value');
      const raw = snap.val();
      const history = !raw || typeof raw !== 'object' ? [] :
        Object.values(raw).sort((a, b) => (Number(b.waktu) || 0) - (Number(a.waktu) || 0)).slice(0, 50);
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 200, { ok: true, history });
    }
    const base = db.ref(`notifikasi/${user.uid}`);
    if (req.method === 'GET' || action === 'list') {
      const snap = await base.once('value');
      const raw = snap.val();
      if (!raw || typeof raw !== 'object') return send(res, 200, {ok:true, notifications:[]});
      const notifications = Object.entries(raw).map(([id, item]) => ({
        id,
        tipe: item?.tipe || 'info',
        judul: item?.judul || 'Notifikasi',
        pesan: item?.pesan || '',
        link: item?.link || '',
        waktu: Number(item?.waktu) || 0,
        dibaca: item?.dibaca === true
      })).sort((a,b) => b.waktu - a.waktu).slice(0, 50);
      return send(res, 200, {ok:true, notifications});
    }
    if (req.method !== 'POST') return send(res, 405, {ok:false,error:'Method tidak diizinkan.'});
    if (action === 'readAll') {
      const snap = await base.once('value');
      const raw = snap.val();
      if (!raw || typeof raw !== 'object') return send(res, 200, {ok:true, updated:0});
      const updates = {};
      let updated = 0;
      for (const id of Object.keys(raw)) {
        if (raw[id]?.dibaca !== true) {
          updates[`${id}/dibaca`] = true;
          updated++;
        }
      }
      if (updated) await base.update(updates);
      return send(res, 200, {ok:true, updated});
    }
    // action=delete — user menghapus satu notifikasi miliknya sendiri
    // (mis. pengumuman yang sudah dibaca). Dipanggil dari profil.html.
    if (action === 'delete') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = clean(body.id, 180);
      if (!id || /[\/.#$\[\]]/.test(id)) return send(res, 400, { ok: false, error: 'ID notifikasi tidak valid.' });
      const refNotif = db.ref(`notifikasi/${user.uid}/${id}`);
      const snap = await refNotif.once('value');
      if (!snap.exists()) return send(res, 404, { ok: false, error: 'Notifikasi tidak ditemukan.' });
      await refNotif.remove();
      return send(res, 200, { ok: true });
    }
    return send(res, 400, {ok:false,error:'Aksi notifikasi tidak dikenal.'});
  } catch (error) {
    console.error('notifications error:', error);
    let status = Number(error.status) || 500;
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') status = 401;
    return send(res, status, {ok:false,error:error.message || 'Gagal memuat notifikasi.'});
  }
};
