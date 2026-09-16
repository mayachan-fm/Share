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

function send(res, status, body) {
  res.status(status).json(body);
}

function cleanUrl(value) {
  let url = String(value || '').trim();
  const markdown = url.match(/^\[.*?\]\((https?:\/\/[^\s)]+)\)$/i);
  if (markdown) url = markdown[1];
  if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1).trim();
  return url;
}

function validUrl(value) {
  try {
    const url = new URL(cleanUrl(value));
    return ['http:', 'https:'].includes(url.protocol);
  } catch (_) {
    return false;
  }
}

function normalizeAddon(item) {
  if (!item || typeof item !== 'object') throw new Error('Data addon tidak valid.');
  const data = item.data && typeof item.data === 'object' ? item.data : item;
  const key = String(item.key || data.slug || '').trim();
  if (!key || !/^[a-z0-9_-]{1,80}$/i.test(key)) throw new Error(`Slug "${key}" tidak valid.`);

  const result = {
    slug: key,
    'nama file': String(data['nama file'] || '').trim(),
    'type file': String(data['type file'] || '').trim(),
    kategori: String(data.kategori || '').trim(),
    'link gambar': cleanUrl(data['link gambar']),
    'link download': cleanUrl(data['link download']),
    'versi mc': String(data['versi mc'] || '').trim(),
    ukuran: String(data.ukuran || '').trim(),
    'tanggal unggah': String(data['tanggal unggah'] || '').trim(),
    description: String(data.description || '').trim()
  };

  if (!result['nama file'] || !result['type file'] || !result.kategori || !result.description) {
    throw new Error(`Data addon "${key}" belum lengkap.`);
  }
  if (!validUrl(result['link gambar'])) throw new Error(`Link gambar untuk "${key}" tidak valid.`);
  if (!validUrl(result['link download'])) throw new Error(`Link download untuk "${key}" tidak valid.`);
  return result;
}

async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN belum disetel di Vercel.');
  const response = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.headers || {})
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });

  try {
    getFirebaseAdmin();
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return send(res, 401, { ok: false, error: 'Login diperlukan.' });

    const idToken = authHeader.slice(7).trim();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const roleSnap = await admin.database().ref(`roles/${decoded.uid}`).once('value');
    const role = String(roleSnap.val() || 'user').toLowerCase();
    if (!['admin', 'owner'].includes(role)) return send(res, 403, { ok: false, error: 'Hanya Admin atau Owner yang boleh mengubah data.json.' });

    const rawAddons = Array.isArray(req.body?.addons) ? req.body.addons : [];
    if (!rawAddons.length || rawAddons.length > 20) return send(res, 400, { ok: false, error: 'Jumlah addon harus antara 1 dan 20.' });

    const incoming = rawAddons.map(normalizeAddon);
    const duplicateIncoming = new Set();
    for (const addon of incoming) {
      if (duplicateIncoming.has(addon.slug)) return send(res, 409, { ok: false, error: `Slug "${addon.slug}" muncul lebih dari sekali.` });
      duplicateIncoming.add(addon.slug);
    }

    const current = await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
    if (!current.content || current.encoding !== 'base64') throw new Error('GitHub tidak mengembalikan isi data.json yang bisa dibaca.');
    const jsonText = Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8');
    let data;
    try { data = JSON.parse(jsonText); } catch (_) { throw new Error('data.json di GitHub bukan JSON yang valid.'); }
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Struktur data.json harus berupa object.');

    for (const addon of incoming) {
      if (Object.prototype.hasOwnProperty.call(data, addon.slug)) return send(res, 409, { ok: false, error: `Slug "${addon.slug}" sudah ada di data.json.`, slug: addon.slug });
      data[addon.slug] = addon;
    }

    const newContent = JSON.stringify(data, null, 2) + '\n';
    const encoded = Buffer.from(newContent, 'utf8').toString('base64');
    const names = incoming.map(a => a['nama file']).join(', ');
    const message = `Tambah addon ke data.json: ${names}`.slice(0, 200);

    const updated = await github(`contents/${PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: encoded,
        sha: current.sha,
        branch: BRANCH
      })
    });

    return send(res, 200, {
      ok: true,
      role,
      count: incoming.length,
      slugs: incoming.map(a => a.slug),
      commitSha: updated.commit?.sha || null,
      commitUrl: updated.commit?.html_url || null
    });
  } catch (error) {
    console.error('add-addon error:', error);
    const status = error.status === 409 ? 409 : (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error' ? 401 : 500);
    return send(res, status, { ok: false, error: error.message || 'Gagal memperbarui data.json.' });
  }
};
