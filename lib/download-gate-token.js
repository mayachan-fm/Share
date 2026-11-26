const crypto = require('crypto');

const USED_PATH = 'download_gate_sessions';
const TOKEN_PREFIX = 'v2';

function buatError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getEncryptionKey() {
  // Use a dedicated secret when configured; otherwise derive from the existing
  // Firebase Admin private key so no additional Vercel variable is required.
  const rawSecret = String(process.env.DOWNLOAD_GATE_SECRET || process.env.FIREBASE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .trim();
  if (!rawSecret) throw new Error('Secret Download Gate tidak tersedia di konfigurasi server.');
  return crypto.createHash('sha256')
    .update('mc-addon-share:download-gate:v2\0')
    .update(rawSecret)
    .digest();
}

function urlDownloadValid(value) {
  try {
    const url = new URL(String(value || ''));
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch (_) {
    return false;
  }
}

function createGateToken(data) {
  const payload = data || {};
  const uid = String(payload.uid || '');
  const slug = String(payload.slug || '').trim();
  const downloadUrl = String(payload.downloadUrl || '').trim();
  const readyAt = Number(payload.readyAt);
  const expiresAt = Number(payload.expiresAt);
  const issuedAt = Number(payload.issuedAt || Date.now());

  if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) throw new Error('Slug addon tidak valid untuk Download Gate.');
  if (!urlDownloadValid(downloadUrl)) throw new Error('Link download addon tidak valid.');
  if (!Number.isFinite(readyAt) || !Number.isFinite(expiresAt) || expiresAt <= readyAt) {
    throw new Error('Waktu sesi Download Gate tidak valid.');
  }

  const content = Buffer.from(JSON.stringify({
    v: 2,
    uid,
    slug,
    url: downloadUrl,
    readyAt,
    expiresAt,
    issuedAt,
    nonce: crypto.randomBytes(16).toString('hex')
  }), 'utf8');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from('mc-addon-share-download-gate-v2', 'utf8'));
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [TOKEN_PREFIX, iv.toString('base64url'), encrypted.toString('base64url'), tag.toString('base64url')].join('.');
}

function isV2GateToken(token) {
  return typeof token === 'string' && token.startsWith(`${TOKEN_PREFIX}.`);
}

function openGateToken(token) {
  const value = String(token || '').trim();
  if (value.length > 4096) throw buatError('Token Download Gate tidak valid.', 400);
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) {
    throw buatError('Format token Download Gate tidak valid.', 400);
  }

  let iv, encrypted, tag;
  try {
    iv = Buffer.from(parts[1], 'base64url');
    encrypted = Buffer.from(parts[2], 'base64url');
    tag = Buffer.from(parts[3], 'base64url');
  } catch (_) {
    throw buatError('Token Download Gate tidak valid.', 400);
  }
  if (iv.length !== 12 || tag.length !== 16 || !encrypted.length) {
    throw buatError('Token Download Gate tidak valid.', 400);
  }

  let parsed;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAAD(Buffer.from('mc-addon-share-download-gate-v2', 'utf8'));
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    parsed = JSON.parse(decrypted.toString('utf8'));
  } catch (_) {
    throw buatError('Token Download Gate tidak dapat diverifikasi. Silakan mulai download lagi.', 403);
  }

  if (!parsed || parsed.v !== 2 || !/^[a-z0-9_-]{1,80}$/i.test(String(parsed.slug || '')) || !urlDownloadValid(parsed.url)) {
    throw buatError('Isi token Download Gate tidak valid.', 400);
  }
  if (!Number.isFinite(Number(parsed.readyAt)) || !Number.isFinite(Number(parsed.expiresAt)) || Number(parsed.expiresAt) <= Number(parsed.readyAt)) {
    throw buatError('Waktu token Download Gate tidak valid.', 400);
  }
  return {
    uid: String(parsed.uid || ''),
    slug: String(parsed.slug),
    downloadUrl: String(parsed.url),
    readyAt: Number(parsed.readyAt),
    expiresAt: Number(parsed.expiresAt),
    issuedAt: Number(parsed.issuedAt) || 0,
    nonce: String(parsed.nonce || '')
  };
}

async function consumeGateToken(database, token, expiresAt) {
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
  const ref = database.ref(`${USED_PATH}/${tokenHash}`);
  const now = Date.now();
  const result = await ref.transaction((current) => {
    if (current !== null && current !== undefined) return;
    return {
      state: 'consumed-v2',
      consumedAt: now,
      expiresAt: Number(expiresAt)
    };
  }, undefined, false);

  if (!result.committed) {
    throw buatError('Token Download Gate sudah pernah digunakan. Silakan mulai download lagi.', 409);
  }
  return true;
}

module.exports = {
  createGateToken,
  openGateToken,
  isV2GateToken,
  consumeGateToken
};
