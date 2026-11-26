const admin = require('firebase-admin');
const { readDownloadSession, consumeDownloadSession, cleanupExpiredDownloadSessions } = require('../lib/download-gate-sessions');
const { openGateToken, isV2GateToken, consumeGateToken } = require('../lib/download-gate-token');
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

async function isPrivilegedUser(database, uid) {
  if (!uid) return false;
  const roleSnap = await database.ref(`roles/${uid}`).once('value');
  const role = String(roleSnap.val() || 'user').toLowerCase();
  if (role === 'admin' || role === 'owner') return true;
  const premiumSnap = await database.ref(`premium/${uid}`).once('value');
  return premiumAktif(premiumSnap.val(), Date.now());
}

async function getCatalogDownloadUrl(slug) {
  const owner = 'mayachan-fm';
  const repo = 'Share';
  const branch = 'main';
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN belum disetel di Vercel.');

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/data.json?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10'
    }
  });
  const raw = await response.text();
  let current;
  try { current = JSON.parse(raw); } catch (_) { current = null; }
  if (!response.ok || !current || !current.content || current.encoding !== 'base64') {
    const reason = current && current.message ? current.message : `GitHub API error ${response.status}`;
    throw new Error(`Katalog addon tidak dapat dibaca: ${reason}`);
  }

  let catalog;
  try {
    catalog = JSON.parse(Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8'));
  } catch (_) {
    throw new Error('Data katalog addon tidak valid.');
  }
  const item = catalog && catalog[slug];
  const link = item && String(item['link download'] || '').trim();
  let parsed;
  try { parsed = new URL(link); } catch (_) { parsed = null; }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    const error = new Error('Link download addon tidak ditemukan atau tidak valid.');
    error.status = 404;
    throw error;
  }
  return link;
}

async function catatDownload(database, slug) {
  const counterPromise = database.ref(`jumlah_unduh/${slug}`).set(admin.database.ServerValue.increment(1));
  waitUntil(counterPromise.catch((error) => console.error('download counter error:', error)));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method tidak diizinkan.' });

  try {
    getFirebaseAdmin();
    const body = parseBody(req);
    const gateToken = String(body.gateToken || '').trim();
    const database = admin.database();
    const currentUid = await verifyCurrentUid(req);

    // Jalur Premium/Admin/Owner: tidak menggunakan token sesi RTDB. Akun
    // diverifikasi ulang di endpoint ini, lalu URL diambil langsung dari katalog
    // server. Guest/User biasa tetap wajib memakai gateToken satu-kali.
    if (!gateToken) {
      const slug = String(body.slug || '').trim();
      if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) {
        return res.status(400).json({ ok: false, error: 'Token atau slug Download Gate tidak valid.' });
      }
      if (!currentUid) {
        return res.status(401).json({ ok: false, error: 'Login diperlukan untuk akses tanpa timer.' });
      }
      const allowed = await isPrivilegedUser(database, currentUid);
      if (!allowed) {
        return res.status(403).json({ ok: false, error: 'Akses Premium/Admin/Owner tidak aktif.' });
      }

      const link = await getCatalogDownloadUrl(slug);
      await catatDownload(database, slug);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, url: link, privileged: true });
    }

    // Token v2 untuk Guest/User biasa tidak bergantung pada pembacaan node sesi
    // Firebase. Payload dienkripsi di server, waktu tunggu diverifikasi di sini,
    // dan pemakaian pertama dikunci dengan transaksi atomik.
    if (isV2GateToken(gateToken)) {
      const payload = openGateToken(gateToken);
      if (payload.uid && payload.uid !== currentUid) {
        return res.status(currentUid ? 403 : 401).json({
          ok: false,
          error: currentUid ? 'Token Download Gate bukan milik akun ini.' : 'Login diperlukan untuk menggunakan sesi download ini.'
        });
      }

      const now = Date.now();
      if (now >= payload.expiresAt) {
        return res.status(410).json({ ok: false, error: 'Sesi Download Gate sudah kedaluwarsa. Silakan mulai download lagi.' });
      }
      if (now < payload.readyAt) {
        const sisa = Math.max(1, Math.ceil((payload.readyAt - now) / 1000));
        return res.status(403).json({ ok: false, error: `Download belum siap. Tunggu ${sisa} detik lagi.` });
      }

      await consumeGateToken(database, gateToken, payload.expiresAt);
      await catatDownload(database, payload.slug);
      waitUntil(cleanupExpiredDownloadSessions(database).catch((error) => {
        console.error('download gate cleanup error:', error);
      }));

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, url: payload.downloadUrl });
    }

    // Dukungan sementara untuk token sesi lama yang masih aktif saat deployment.
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

    await catatDownload(database, session.slug);
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
