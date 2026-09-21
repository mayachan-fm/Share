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
