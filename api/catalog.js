const admin = require('firebase-admin');

const OWNER = 'mayachan-fm';
const REPO = 'Share';
const PATH = 'data.json';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

function send(res, status, body) {
  res.status(status).json(body);
}

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
  if (!response.ok) {
    const error = new Error(body.message || `GitHub API error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function readCatalog() {
  const current = await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
  if (!current.content || current.encoding !== 'base64') throw new Error('GitHub tidak mengembalikan katalog yang bisa dibaca.');
  const jsonText = Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8');
  let data;
  try { data = JSON.parse(jsonText); } catch (_) { throw new Error('Katalog di GitHub bukan JSON yang valid.'); }
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Struktur katalog harus berupa object.');
  return data;
}

async function verifyManageUser(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decoded = await admin.auth().verifyIdToken(authHeader.slice(7).trim());
  const roleSnap = await admin.database().ref(`roles/${decoded.uid}`).once('value');
  const role = String(roleSnap.val() || 'user').toLowerCase();
  if (!['admin', 'owner'].includes(role)) return null;
  return { decoded, role };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });

  try {
    const data = await readCatalog();
    const mode = String(req.query?.mode || '').toLowerCase();

    if (mode === 'manage') {
      getFirebaseAdmin();
      const access = await verifyManageUser(req);
      if (!access) return send(res, 403, { ok: false, error: 'Akses panel pengelolaan ditolak.' });
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 200, data);
    }

    // Public catalog: download URLs are deliberately removed. Downloads go through the server gate.
    const publicData = {};
    for (const [key, item] of Object.entries(data)) {
      if (!item || typeof item !== 'object') continue;
      const safe = { ...item };
      delete safe['link download'];
      publicData[key] = safe;
    }

    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, publicData);
  } catch (error) {
    return send(res, Number(error.status) || 500, { ok: false, error: error.message || 'Gagal memuat katalog.' });
  }
};
