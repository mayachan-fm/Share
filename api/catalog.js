const admin = require('firebase-admin');
const crypto = require('crypto');

const OWNER = 'mayachan-fm';
const REPO = 'Share';
const PATH = 'data.json';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';
const CATALOG_CACHE_TTL = 60 * 1000;
const PRIVILEGED_TOKEN_TTL = 5 * 60 * 1000;

let catalogCache = null;
let catalogCacheAt = 0;

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

async function github(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN belum disetel di Vercel.');
  const response = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch (_) { body = { message: text }; }
  if (!response.ok) { const e = new Error(body.message || `GitHub API error ${response.status}`); e.status = response.status; throw e; }
  return body;
}

async function readCatalogCached() {
  const now = Date.now();
  if (catalogCache && now - catalogCacheAt < CATALOG_CACHE_TTL) return catalogCache;
  const current = await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
  if (!current.content || current.encoding !== 'base64') throw new Error('GitHub tidak mengembalikan katalog yang bisa dibaca.');
  const jsonText = Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8');
  let data;
  try { data = JSON.parse(jsonText); } catch (_) { throw new Error('Katalog di GitHub bukan JSON yang valid.'); }
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Struktur katalog harus berupa object.');
  catalogCache = data;
  catalogCacheAt = now;
  return data;
}

function signingSecret() {
  const source = process.env.DOWNLOAD_GATE_SECRET || process.env.FIREBASE_PRIVATE_KEY || process.env.GITHUB_TOKEN;
  if (!source) throw new Error('Secret Download Gate belum tersedia di server.');
  return crypto.createHash('sha256').update(String(source)).digest();
}

function signAccessToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function premiumAktif(data, now) {
  if (!data || typeof data !== 'object' || data.dicabutPada) return false;
  const tipe = String(data.tipe || '').toLowerCase();
  const berakhir = data.berakhir === null || data.berakhir === undefined || data.berakhir === '' ? null : Number(data.berakhir);
  return tipe === 'permanen' || berakhir === null || (Number.isFinite(berakhir) && now < berakhir);
}

async function getPrivilegedAccess(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  getFirebaseAdmin();
  const decoded = await admin.auth().verifyIdToken(header.slice(7).trim());
  const uid = decoded.uid;
  const roleSnap = await admin.database().ref(`roles/${uid}`).once('value');
  const role = String(roleSnap.val() || 'user').toLowerCase();
  if (role === 'admin' || role === 'owner') return { uid, role };
  const premiumSnap = await admin.database().ref(`premium/${uid}`).once('value');
  if (premiumAktif(premiumSnap.val(), Date.now())) return { uid, role: 'premium' };
  return null;
}

async function verifyManageUser(req) {
  const access = await getPrivilegedAccess(req);
  if (!access || !['admin', 'owner'].includes(access.role)) return null;
  return access;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
  try {
    const data = await readCatalogCached();
    const mode = String(req.query?.mode || '').toLowerCase();
    const slug = String(req.query?.slug || '').trim();

    if (mode === 'manage') {
      const access = await verifyManageUser(req);
      if (!access) return send(res, 403, { ok: false, error: 'Akses panel pengelolaan ditolak.' });
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 200, data);
    }

    // Detail hanya membutuhkan satu addon. Link download tetap disembunyikan dari guest/user biasa.
    if (slug) {
      const item = data[slug];
      if (!item || typeof item !== 'object') return send(res, 404, { ok: false, error: 'Addon tidak ditemukan.' });
      const safe = { ...item };
      delete safe['link download'];

      let downloadAccessToken = null;
      try {
        const access = await getPrivilegedAccess(req);
        if (access && /^https?:\/\//i.test(String(item['link download'] || ''))) {
          const now = Date.now();
          downloadAccessToken = signAccessToken({
            uid: access.uid,
            slug,
            downloadUrl: String(item['link download']),
            privileged: true,
            readyAt: now,
            expiresAt: now + PRIVILEGED_TOKEN_TTL,
            issuedAt: now,
            nonce: crypto.randomUUID()
          });
        }
      } catch (error) {
        console.warn('Privileged detail access unavailable:', error.message || error);
      }

      res.setHeader('Cache-Control', 'no-store');
      return send(res, 200, { ok: true, idAddon: slug, item: safe, downloadAccessToken });
    }

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
