const admin = require('firebase-admin');
const { catatAktivitas } = require('../lib/activity');

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
  return { aktif: !revoked && !expired, kadaluarsa: expired, dicabut: revoked };
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, {ok:false, error:'Method tidak diizinkan.'});
  try {
    getFirebaseAdmin();
    const owner = await verifyOwner(req);
    const action = String(req.body?.action || '').trim();
    const db = admin.database();

    if (action === 'list') return send(res, 200, {ok:true, premium: await buildPremiumList()});

    if (action === 'grant') {
      const target = await resolveUser(req.body?.identifier);
      const duration = String(req.body?.duration || '').trim().toLowerCase();
      const days = { '7_hari':7, '30_hari':30, '90_hari':90 };
      if (!days[duration] && duration !== 'permanen') return send(res, 400, {ok:false,error:'Durasi Premium tidak valid.'});
      if (target.uid === owner.uid) return send(res, 400, {ok:false,error:'Gunakan akun Premium target, bukan akun Owner.'});
      const mulai = Date.now();
      const berakhir = duration === 'permanen' ? null : mulai + days[duration] * 24 * 60 * 60 * 1000;
      const payload = {tipe: duration, mulai, berakhir, dicabutPada: null, diberikanOleh: owner.uid};
      await db.ref(`premium/${target.uid}`).set(payload);
      await catatAktivitas({decoded:owner, role:'owner', aksi:'premium_beri', targetId:target.uid, targetName:target.email || target.uid, detail:`Memberikan Premium ${duration}`});
      return send(res, 200, {ok:true,message:`Premium ${duration} berhasil diberikan kepada ${target.email || 'akun tersebut'}.`});
    }

    if (action === 'revoke') {
      const uid = String(req.body?.uid || '').trim();
      if (!uid) return send(res, 400, {ok:false,error:'UID Premium tidak diberikan.'});
      if (uid === owner.uid) return send(res, 400, {ok:false,error:'Owner tidak dapat mencabut akses dirinya sendiri.'});
      const ref = db.ref(`premium/${uid}`);
      const snap = await ref.once('value');
      if (!snap.exists()) return send(res, 404, {ok:false,error:'Data Premium tidak ditemukan.'});
      const current = snap.val() || {};
      await ref.update({dicabutPada:Date.now()});
      let targetEmail = uid;
      try { targetEmail = (await admin.auth().getUser(uid)).email || uid; } catch (_) {}
      await catatAktivitas({decoded:owner, role:'owner', aksi:'premium_cabut', targetId:uid, targetName:targetEmail, detail:'Mencabut akses Premium'});
      return send(res, 200, {ok:true,message:`Premium ${targetEmail} berhasil dicabut.`});
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
