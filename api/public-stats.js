const admin = require('firebase-admin');

let cachedTotal = null;
let cachedAt = 0;
const CACHE_TTL = 60 * 1000;

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

async function hitungTotalPengguna() {
  const now = Date.now();
  if (cachedTotal !== null && now - cachedAt < CACHE_TTL) return cachedTotal;

  let total = 0;
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    total += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken);

  cachedTotal = total;
  cachedAt = now;
  return total;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method tidak diizinkan.' });
  }

  try {
    getFirebaseAdmin();
    const totalPengguna = await hitungTotalPengguna();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.status(200).json({ ok: true, totalPengguna });
  } catch (error) {
    console.error('public-stats error:', error);
    return res.status(500).json({ ok: false, error: 'Gagal membaca jumlah pengguna.' });
  }
};
