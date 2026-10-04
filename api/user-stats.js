const admin = require('firebase-admin');

function init() {
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

function send(res, status, body) {
  res.status(status).json(body);
}

async function getOwnerFromToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const decoded = await admin.auth().verifyIdToken(header.slice(7).trim());
  const roleSnap = await admin.database().ref(`roles/${decoded.uid}`).once('value');
  const role = String(roleSnap.val() || 'user').toLowerCase();
  if (role !== 'owner') return null;
  return decoded;
}

async function countUsers() {
  let total = 0;
  let pageToken;

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    total += result.users.length;
    pageToken = result.pageToken;
  } while (pageToken);

  return total;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });

  try {
    init();
    const owner = await getOwnerFromToken(req);
    if (!owner) return send(res, 403, { ok: false, error: 'Hanya Owner yang boleh melihat jumlah pengguna.' });

    const totalUsers = await countUsers();
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, { ok: true, totalUsers });
  } catch (error) {
    console.error('user stats error:', error);
    const status = error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error' ? 401 : 500;
    return send(res, status, { ok: false, error: error.message || 'Gagal membaca jumlah pengguna.' });
  }
};
