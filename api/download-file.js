const admin = require('firebase-admin');

const OWNER = 'mayachan-fm';
const REPO = 'Share';
const PATH = 'data.json';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

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

async function github(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN belum disetel di Vercel.');
  const response = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10'
    }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch (_) { body = { message: text }; }
  if (!response.ok) throw new Error(body.message || `GitHub API error ${response.status}`);
  return body;
}

async function readCatalog() {
  const current = await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
  const jsonText = Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return JSON.parse(jsonText);
}

async function verifyCurrentUid(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const decoded = await admin.auth().verifyIdToken(header.slice(7).trim());
    return decoded.uid;
  }

  const body = parseBody(req);
  const idToken = String(body.idToken || '').trim();
  if (!idToken) return null;
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded.uid;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = String(req.body || '');
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method tidak diizinkan.' });

  try {
    getFirebaseAdmin();
    const body = parseBody(req);
    const gateToken = String(body.gateToken || '').trim();
    if (!gateToken || !/^[0-9a-f-]{36}$/i.test(gateToken)) {
      return res.status(400).json({ ok: false, error: 'Token Download Gate tidak valid.' });
    }

    // Verifikasi identitas SEBELUM token dipakai. Ini mencegah token
    // Premium/login menjadi usedAt hanya karena request belum membawa UID.
    const currentUid = await verifyCurrentUid(req);

    const gateRef = admin.database().ref(`download_gates/${gateToken}`);
    const gateSnap = await gateRef.once('value');
    if (!gateSnap.exists()) {
      return res.status(403).json({ ok: false, error: 'Sesi Download Gate tidak ditemukan.' });
    }

    const session = gateSnap.val() || {};
    const now = Date.now();

    if (session.usedAt) {
      return res.status(403).json({ ok: false, error: 'Download belum siap atau token sudah digunakan.' });
    }
    if (now > Number(session.expiresAt || 0)) {
      return res.status(403).json({ ok: false, error: 'Sesi Download Gate sudah kedaluwarsa. Silakan mulai download lagi.' });
    }
    if (session.uid && session.uid !== currentUid) {
      return res.status(403).json({ ok: false, error: 'Token Download Gate bukan milik akun ini.' });
    }
    if (now < Number(session.readyAt || 0)) {
      const sisa = Math.max(1, Math.ceil((Number(session.readyAt) - now) / 1000));
      return res.status(403).json({ ok: false, error: `Download belum siap. Tunggu ${sisa} detik lagi.` });
    }

    // Re-check privileged access at the moment the file is opened.
    // Revoking Premium/Admin/Owner during the waiting window therefore removes the bypass.
    if (session.bypass) {
      if (!currentUid) {
        return res.status(403).json({ ok: false, error: 'Login diperlukan untuk akses istimewa.' });
      }
      const roleSnap = await admin.database().ref(`roles/${currentUid}`).once('value');
      const role = String(roleSnap.val() || 'user').toLowerCase();
      let stillAllowed = role === 'admin' || role === 'owner';
      if (!stillAllowed) {
        const premiumSnap = await admin.database().ref(`premium/${currentUid}`).once('value');
        const premium = premiumSnap.val();
        if (premium && !premium.dicabutPada) {
          const tipe = String(premium.tipe || '').toLowerCase();
          const berakhir = premium.berakhir === null || premium.berakhir === undefined || premium.berakhir === '' ? null : Number(premium.berakhir);
          stillAllowed = tipe === 'permanen' || berakhir === null || (Number.isFinite(berakhir) && Date.now() < berakhir);
        }
      }
      if (!stillAllowed) {
        return res.status(403).json({ ok: false, error: 'Akses Premium/Admin/Owner sudah tidak aktif.' });
      }
    }

    // Consume token atomically only after every validation above succeeds.
    const transaction = await gateRef.transaction((current) => {
      if (!current || current.usedAt) return;
      const txNow = Date.now();
      if (txNow > Number(current.expiresAt || 0)) return;
      if (txNow < Number(current.readyAt || 0)) return;
      if (current.uid && current.uid !== currentUid) return;
      return { ...current, usedAt: txNow };
    });

    if (!transaction.committed || !transaction.snapshot.exists()) {
      return res.status(403).json({ ok: false, error: 'Download belum siap atau token sudah digunakan.' });
    }

    const consumedSession = transaction.snapshot.val() || {};
    const catalog = await readCatalog();
    const item = catalog[consumedSession.slug];
    const link = item && item['link download'];
    if (!link || !/^https?:\/\//i.test(String(link))) {
      await gateRef.update({ usedAt: null });
      return res.status(404).json({ ok: false, error: 'Link download tidak tersedia.' });
    }

    const downloadRef = admin.database().ref(`jumlah_unduh/${consumedSession.slug}`);
    await downloadRef.transaction((value) => Math.max(0, Number(value) || 0) + 1);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, url: String(link) });
  } catch (error) {
    console.error('download-file error:', error);
    const status = error.code && String(error.code).startsWith('auth/') ? 401 : 500;
    return res.status(status).json({ ok: false, error: error.message || 'Gagal membuka download.' });
  }
};
