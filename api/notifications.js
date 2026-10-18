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
    const action = String(req.query?.action || req.body?.action || 'list').trim();

    // Laporan addon digabung ke fungsi ini agar jumlah Serverless Functions tetap <= 12.
    if (action === 'reports') {
      const roleSnap = await db.ref(`roles/${user.uid}`).once('value');
      const role = String(roleSnap.val() || 'user').toLowerCase();

      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const slug = String(body.slug || '').trim().slice(0, 120);
        const reason = String(body.reason || '').trim().slice(0, 80);
        const message = String(body.message || '').trim().slice(0, 800);
        if (!slug || !reason || message.length < 10) return send(res, 400, {ok:false,error:'Pilih alasan dan tulis pesan minimal 10 karakter (maksimal 800).'});
        const catalogUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://mc-share.vercel.app'}/api/catalog?slug=${encodeURIComponent(slug)}`;
        const catalogRes = await fetch(catalogUrl);
        if (!catalogRes.ok) return send(res, 404, {ok:false,error:'Addon tidak ditemukan.'});
        const catalog = await catalogRes.json();
        const addon = catalog?.item || catalog;
        if (!addon || !addon.slug) return send(res, 404, {ok:false,error:'Addon tidak ditemukan.'});
        const rateRef = db.ref(`batas_laporan/${user.uid}/${slug}`);
        const now = Date.now();
        const rate = await rateRef.once('value');
        if (rate.exists() && now - Number(rate.val()) < 10 * 60 * 1000) return send(res, 429, {ok:false,error:'Kamu baru saja melaporkan addon ini. Coba lagi dalam 10 menit.'});
        const reportRef = db.ref('laporan').push();
        await reportRef.set({id:reportRef.key,slug,namaAddon:String(addon['nama file'] || addon.nama || slug).trim().slice(0,180),reason,message,uid:user.uid,username:String(user.name || user.email?.split('@')[0] || 'Pengguna').slice(0,80),email:String(user.email || '').slice(0,160),waktu:now,status:'belum_ditinjau'});
        await rateRef.set(now);
        return send(res, 201, {ok:true,message:'Laporan berhasil dikirim.'});
      }

      if (!['owner'].includes(role)) return send(res, 403, {ok:false,error:'Hanya Owner yang dapat mengelola laporan.'});
      if (req.method === 'GET') {
        const snap = await db.ref('laporan').orderByChild('waktu').limitToLast(300).once('value');
        const reports = Object.entries(snap.val() || {}).map(([id,item]) => ({id,...item})).sort((a,b)=>(Number(b.waktu)||0)-(Number(a.waktu)||0));
        res.setHeader('Cache-Control','no-store');
        return send(res, 200, {ok:true,reports});
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = String(body.id || '').trim().slice(0,180);
      if (!id || id.includes('/')) return send(res,400,{ok:false,error:'ID laporan tidak valid.'});
      const reportRef = db.ref(`laporan/${id}`);
      const reportSnap = await reportRef.once('value');
      if (!reportSnap.exists()) return send(res,404,{ok:false,error:'Laporan tidak ditemukan.'});
      if (req.method === 'DELETE') { await reportRef.remove(); return send(res,200,{ok:true,message:'Laporan dihapus.'}); }
      if (req.method === 'PATCH') {
        const status = String(body.status || '').trim();
        if (!['belum_ditinjau','sedang_diperiksa','selesai'].includes(status)) return send(res,400,{ok:false,error:'Status laporan tidak valid.'});
        await reportRef.update({status,ditinjauOleh:user.uid,diubahPada:Date.now()});
        return send(res,200,{ok:true,message:'Status laporan diperbarui.'});
      }
      return send(res,405,{ok:false,error:'Method tidak diizinkan.'});
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

    return send(res, 400, {ok:false,error:'Aksi notifikasi tidak dikenal.'});
  } catch (error) {
    console.error('notifications error:', error);
    let status = Number(error.status) || 500;
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') status = 401;
    return send(res, status, {ok:false,error:error.message || 'Gagal memuat notifikasi.'});
  }
};
