const admin = require('firebase-admin');
const { readDownloadSession, consumeDownloadSession, cleanupExpiredDownloadSessions } = require('../lib/download-gate-sessions');
const { waitUntil } = require('@vercel/functions');

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

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = String(req.body || '');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) {}
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

async function verifyCurrentUid(req) {
  const header = req.headers.authorization || '';
  let idToken = '';
  if (header.startsWith('Bearer ')) idToken = header.slice(7).trim();
  if (!idToken) {
    const body = parseBody(req);
    idToken = String(body.idToken || '').trim();
  }
  if (!idToken) return null;
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded.uid;
}

function premiumAktif(data, now) {
  if (!data || typeof data !== 'object' || data.dicabutPada) return false;
  const tipe = String(data.tipe || '').toLowerCase();
  const berakhir = data.berakhir === null || data.berakhir === undefined || data.berakhir === '' ? null : Number(data.berakhir);
  return tipe === 'permanen' || berakhir === null || (Number.isFinite(berakhir) && now < berakhir);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method tidak diizinkan.' });

  try {
    getFirebaseAdmin();
    const body = parseBody(req);
    const gateToken = String(body.gateToken || '').trim();
    if (!gateToken) return res.status(400).json({ ok: false, error: 'Token Download Gate tidak ditemukan.' });

    const database = admin.database();
    const currentUid = await verifyCurrentUid(req);
    const preview = await readDownloadSession(database, gateToken);

    // Setiap token yang dibuat untuk akun login terikat pada UID tersebut.
    // Token istimewa yang dibuat saat detail dimuat juga wajib berasal dari
    // akun yang sama; token tidak bisa dipindahkan ke akun lain.
    if (preview.uid && preview.uid !== currentUid) {
      return res.status(currentUid ? 403 : 401).json({
        ok: false,
        error: currentUid ? 'Token Download Gate bukan milik akun ini.' : 'Login diperlukan untuk menggunakan sesi download ini.'
      });
    }

    // Setiap sesi bypass selalu memeriksa ulang Premium/role saat token ditukar.
    // Dengan begitu, status yang sudah dicabut tidak bisa memakai sesi lama.
    if (preview.bypass === true) {
      if (!currentUid) return res.status(403).json({ ok: false, error: 'Login diperlukan untuk akses istimewa.' });
      const roleSnap = await database.ref(`roles/${currentUid}`).once('value');
      const role = String(roleSnap.val() || 'user').toLowerCase();
      let stillAllowed = role === 'admin' || role === 'owner';
      if (!stillAllowed) {
        const premiumSnap = await database.ref(`premium/${currentUid}`).once('value');
        stillAllowed = premiumAktif(premiumSnap.val(), Date.now());
      }
      if (!stillAllowed) return res.status(403).json({ ok: false, error: 'Akses Premium/Admin/Owner sudah tidak aktif.' });
    }

    // Transaksi Firebase mengunci token secara atomik. Dari dua permintaan
    // bersamaan hanya satu yang dapat mengubah state available menjadi consumed.
    const session = await consumeDownloadSession(database, gateToken, currentUid);
    const link = String(session.downloadUrl);

    const counterPromise = database.ref(`jumlah_unduh/${session.slug}`).set(admin.database.ServerValue.increment(1));
    waitUntil(counterPromise.catch((error) => console.error('download counter error:', error)));
    waitUntil(cleanupExpiredDownloadSessions(database).catch((error) => {
      console.error('download gate cleanup error:', error);
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, url: link });
  } catch (error) {
    console.error('download-file error:', error);
    const status = Number(error.status) || (error.code && String(error.code).startsWith('auth/') ? 401 : 500);
    return res.status(status).json({ ok: false, error: error.message || 'Gagal membuka download.' });
  }
};
