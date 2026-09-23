const admin = require('firebase-admin');
const crypto = require('crypto');

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

function signingSecret() {
  const source = process.env.DOWNLOAD_GATE_SECRET || process.env.FIREBASE_PRIVATE_KEY || process.env.GITHUB_TOKEN;
  if (!source) throw new Error('Secret Download Gate belum tersedia di server.');
  return crypto.createHash('sha256').update(String(source)).digest();
}

function verifyGateToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Token Download Gate tidak valid.');
  const [encodedPayload, encodedSig] = parts;
  const expected = crypto.createHmac('sha256', signingSecret()).update(encodedPayload).digest('base64url');
  const a = Buffer.from(encodedSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Token Download Gate tidak valid.');

  let payload;
  try { payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')); } catch (_) {
    throw new Error('Token Download Gate rusak.');
  }
  if (!payload || !/^[a-z0-9_-]{1,80}$/i.test(String(payload.slug || ''))) throw new Error('Token Download Gate tidak lengkap.');
  if (!/^https?:\/\//i.test(String(payload.downloadUrl || ''))) throw new Error('Link download dalam token tidak valid.');
  return payload;
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
    const body = parseBody(req);
    const gateToken = String(body.gateToken || '').trim();
    if (!gateToken) return res.status(400).json({ ok: false, error: 'Token Download Gate tidak ditemukan.' });

    const session = verifyGateToken(gateToken);
    const now = Date.now();
    if (now > Number(session.expiresAt || 0)) {
      return res.status(403).json({ ok: false, error: 'Sesi Download Gate sudah kedaluwarsa. Silakan mulai download lagi.' });
    }
    if (now < Number(session.readyAt || 0)) {
      const sisa = Math.max(1, Math.ceil((Number(session.readyAt) - now) / 1000));
      return res.status(403).json({ ok: false, error: `Download belum siap. Tunggu ${sisa} detik lagi.` });
    }

    // Fast path untuk Premium/Admin/Owner. Token ini sudah dibuat setelah akses
    // diverifikasi di /api/catalog dan hanya berlaku singkat. Tidak perlu Firebase
    // Auth/Realtime Database lagi pada saat klik download.
    if (session.privileged === true) {
      getFirebaseAdmin();
      await admin.database().ref(`jumlah_unduh/${session.slug}`).set(admin.database.ServerValue.increment(1));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, url: String(session.downloadUrl) });
    }

    getFirebaseAdmin();
    const currentUid = await verifyCurrentUid(req);
    if (session.uid && session.uid !== currentUid) {
      return res.status(403).json({ ok: false, error: 'Token Download Gate bukan milik akun ini.' });
    }
    if (session.uid && !currentUid) {
      return res.status(401).json({ ok: false, error: 'Sesi login tidak dapat diverifikasi. Silakan login ulang.' });
    }

    if (session.bypass) {
      if (!currentUid) return res.status(403).json({ ok: false, error: 'Login diperlukan untuk akses istimewa.' });
      const roleSnap = await admin.database().ref(`roles/${currentUid}`).once('value');
      const role = String(roleSnap.val() || 'user').toLowerCase();
      let stillAllowed = role === 'admin' || role === 'owner';
      if (!stillAllowed) {
        const premiumSnap = await admin.database().ref(`premium/${currentUid}`).once('value');
        stillAllowed = premiumAktif(premiumSnap.val(), now);
      }
      if (!stillAllowed) return res.status(403).json({ ok: false, error: 'Akses Premium/Admin/Owner sudah tidak aktif.' });
    }

    const link = String(session.downloadUrl);

    // Tunggu penambahan counter selesai sebelum mengembalikan URL.
    // ServerValue.increment() membuat penambahan tetap atomik saat banyak pengguna
    // mengunduh addon yang sama secara bersamaan.
    await admin.database().ref(`jumlah_unduh/${session.slug}`).set(admin.database.ServerValue.increment(1));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, url: link });
  } catch (error) {
    console.error('download-file error:', error);
    const status = error.code && String(error.code).startsWith('auth/') ? 401 : 500;
    return res.status(status).json({ ok: false, error: error.message || 'Gagal membuka download.' });
  }
};
