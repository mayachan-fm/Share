const admin = require('firebase-admin');
const { catatAktivitas } = require('../lib/activity');

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

function send(res, status, body) { res.status(status).json(body); }

async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN belum disetel di Vercel.');
  const response = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
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

    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7).trim());
    const roleSnap = await admin.database().ref(`roles/${decoded.uid}`).once('value');
    const role = String(roleSnap.val() || 'user').toLowerCase();
    if (!['admin', 'owner'].includes(role)) {
      return send(res, 403, { ok: false, error: 'Hanya Admin atau Owner yang boleh menghapus addon.' });
    }

    const key = String(req.body?.key || '').trim();
    if (!key || !/^[a-z0-9_-]{1,80}$/i.test(key)) {
      return send(res, 400, { ok: false, error: 'Slug/ID addon tidak valid.' });
    }

    const current = await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
    if (!current.content || current.encoding !== 'base64') {
      throw new Error('GitHub tidak mengembalikan isi data.json yang bisa dibaca.');
    }

    const jsonText = Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8');
    let data;
    try { data = JSON.parse(jsonText); } catch (_) {
      throw new Error('data.json di GitHub bukan JSON yang valid.');
    }
    if (!data || Array.isArray(data) || typeof data !== 'object') {
      throw new Error('Struktur data.json harus berupa object.');
    }

    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      return send(res, 404, { ok: false, error: `Addon dengan slug "${key}" tidak ditemukan di data.json.` });
    }

    const namaAddon = String(data[key]?.['nama file'] || key);
    delete data[key];

    const newContent = JSON.stringify(data, null, 2) + '\n';
    const encoded = Buffer.from(newContent, 'utf8').toString('base64');
    const updated = await github(`contents/${PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Hapus addon dari data.json: ${namaAddon}`.slice(0, 200),
        content: encoded,
        sha: current.sha,
        branch: BRANCH
      })
    });

    await catatAktivitas({decoded,role,aksi:'addon_hapus',targetId:key,targetName:namaAddon,detail:'Menghapus addon dari data.json'});

    return send(res, 200, {
      ok: true,
      role,
      slug: key,
      nama: namaAddon,
      commitSha: updated.commit?.sha || null,
      commitUrl: updated.commit?.html_url || null
    });
  } catch (error) {
    console.error('delete-addon error:', error);
    const status = error.status === 409 ? 409 : (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error' ? 401 : 500);
    return send(res, status, { ok: false, error: error.message || 'Gagal menghapus addon.' });
  }
};
