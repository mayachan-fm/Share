const admin = require('firebase-admin');
const { createGateToken } = require('../lib/download-gate-token');

const OWNER = 'mayachan-fm';
const REPO = 'Share';
const PATH = 'data.json';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';
const WAIT_MIN = 10;
const WAIT_MAX = 20;
const SESSION_TTL = 15 * 60 * 1000;
const CATALOG_CACHE_TTL = 60 * 1000;

let catalogCache = null;
let catalogCacheAt = 0;

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

async function readCatalogCached() {
  const now = Date.now();
  if (catalogCache && now - catalogCacheAt < CATALOG_CACHE_TTL) return catalogCache;

  const current = await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
  const jsonText = Buffer.from(String(current.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  const data = JSON.parse(jsonText);
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Struktur katalog tidak valid.');

  catalogCache = data;
  catalogCacheAt = now;
  return data;
}

async function identifyUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return { uid: null, role: 'user' };
  const decoded = await admin.auth().verifyIdToken(header.slice(7).trim());
  const roleSnap = await admin.database().ref(`roles/${decoded.uid}`).once('value');
  const role = String(roleSnap.val() || 'user').toLowerCase();
  return { uid: decoded.uid, role };
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const slug = String(body.slug || '').trim();
    if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) return res.status(400).json({ ok: false, error: 'Slug addon tidak valid.' });

    const catalog = await readCatalogCached();
    const item = catalog[slug];
    const link = item && item['link download'];
    if (!item || typeof item !== 'object' || !/^https?:\/\//i.test(String(link || ''))) {
      return res.status(404).json({ ok: false, error: 'Addon atau link download tidak ditemukan.' });
    }

    const user = await identifyUser(req);
    const now = Date.now();
    let bypass = ['admin', 'owner'].includes(user.role);
    if (!bypass && user.uid) {
      const premiumSnap = await admin.database().ref(`premium/${user.uid}`).once('value');
      bypass = premiumAktif(premiumSnap.val(), now);
    }

    // Premium/Admin/Owner tidak memakai node sesi Firebase. Akses istimewa
    // akan diverifikasi ulang pada /api/download-file ketika tombol download
    // ditekan. Ini menghindari sesi Premium hilang/tidak terbaca antar function.
    if (bypass) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        ok: true,
        gateToken: null,
        waitSeconds: 0,
        bypass: true,
        directPrivileged: true
      });
    }

    const waitSeconds = Math.floor(Math.random() * (WAIT_MAX - WAIT_MIN + 1)) + WAIT_MIN;
    const readyAt = now + waitSeconds * 1000;
    // User/Guest memakai token terenkripsi yang ditandatangani melalui AES-GCM.
    // Tidak ada lagi sesi yang harus dibuat lalu dicari ulang di Firebase;
    // status sekali-pakai baru dicatat secara atomik ketika token ditebus.
    const gateToken = createGateToken({
      uid: user.uid,
      slug,
      downloadUrl: String(link),
      readyAt,
      expiresAt: now + SESSION_TTL,
      issuedAt: now
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, gateToken, waitSeconds, bypass: false });
  } catch (error) {
    console.error('download-gate start error:', error);
    const status = error.code && String(error.code).startsWith('auth/') ? 401 : 500;
    return res.status(status).json({ ok: false, error: error.message || 'Gagal menyiapkan Download Gate.' });
  }
};
