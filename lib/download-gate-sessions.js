const crypto = require('crypto');

const SESSION_PATH = 'download_gate_sessions';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function buatError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hashToken(token) {
  const value = String(token || '').trim();
  if (!TOKEN_PATTERN.test(value)) {
    throw buatError('Token Download Gate tidak valid. Silakan mulai download lagi.', 400);
  }
  return crypto.createHash('sha256').update(value).digest('hex');
}

function urlDownloadValid(value) {
  try {
    const url = new URL(String(value || ''));
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch (_) {
    return false;
  }
}

async function createDownloadSession(database, options) {
  const data = options || {};
  const slug = String(data.slug || '').trim();
  const downloadUrl = String(data.downloadUrl || '').trim();
  const readyAt = Number(data.readyAt);
  const expiresAt = Number(data.expiresAt);

  if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) throw new Error('Slug addon tidak valid untuk sesi download.');
  if (!urlDownloadValid(downloadUrl)) throw new Error('Link download addon tidak valid.');
  if (!Number.isFinite(readyAt) || !Number.isFinite(expiresAt) || expiresAt <= readyAt) {
    throw new Error('Waktu sesi Download Gate tidak valid.');
  }

  // Token acak tidak memuat UID, slug, ataupun URL. Database hanya menyimpan
  // hash token sehingga token mentah tidak tersimpan di Firebase.
  const token = crypto.randomBytes(32).toString('base64url');
  const key = hashToken(token);
  const session = {
    uid: String(data.uid || ''),
    slug,
    downloadUrl,
    readyAt,
    expiresAt,
    bypass: data.bypass === true,
    fastPrivileged: data.fastPrivileged === true,
    state: 'available',
    createdAt: Number(data.createdAt) || Date.now()
  };

  await database.ref(`${SESSION_PATH}/${key}`).set(session);
  return token;
}

async function readDownloadSession(database, token) {
  const key = hashToken(token);
  const snapshot = await database.ref(`${SESSION_PATH}/${key}`).once('value');
  if (!snapshot.exists()) throw buatError('Sesi Download Gate tidak ditemukan atau sudah tidak berlaku.', 410);
  const session = snapshot.val() || {};
  if (!/^[a-z0-9_-]{1,80}$/i.test(String(session.slug || '')) || !urlDownloadValid(session.downloadUrl)) {
    throw buatError('Data sesi Download Gate tidak valid. Silakan mulai download lagi.', 400);
  }
  return session;
}

function alasanSesiTidakBisaDipakai(session, currentUid, now) {
  if (!session) return { message: 'Sesi Download Gate tidak ditemukan atau sudah tidak berlaku.', status: 410 };
  if (session.state !== 'available') return { message: 'Token Download Gate sudah pernah digunakan. Mulai download lagi.', status: 409 };
  if (session.uid && !currentUid) {
    return { message: 'Login diperlukan untuk menggunakan sesi download ini.', status: 401 };
  }
  if (session.uid && session.uid !== currentUid) {
    return { message: 'Token Download Gate bukan milik akun ini.', status: 403 };
  }
  if (session.fastPrivileged === true && (!session.uid || session.uid !== currentUid)) {
    return { message: 'Token akses istimewa bukan milik akun ini.', status: 403 };
  }
  const expiresAt = Number(session.expiresAt || 0);
  const readyAt = Number(session.readyAt || 0);
  if (!Number.isFinite(expiresAt) || now >= expiresAt) {
    return { message: 'Sesi Download Gate sudah kedaluwarsa. Silakan mulai download lagi.', status: 410 };
  }
  if (!Number.isFinite(readyAt) || now < readyAt) {
    const sisa = Math.max(1, Math.ceil((readyAt - now) / 1000));
    return { message: `Download belum siap. Tunggu ${sisa} detik lagi.`, status: 403 };
  }
  return null;
}

async function consumeDownloadSession(database, token, currentUid) {
  const key = hashToken(token);
  const ref = database.ref(`${SESSION_PATH}/${key}`);
  const transaction = await ref.transaction((current) => {
    const reason = alasanSesiTidakBisaDipakai(current, currentUid, Date.now());
    if (reason) return;
    return {
      ...current,
      state: 'consumed',
      consumedAt: Date.now()
    };
  }, undefined, false);

  if (!transaction.committed) {
    const reason = alasanSesiTidakBisaDipakai(transaction.snapshot?.val() || null, currentUid, Date.now());
    if (reason) throw buatError(reason.message, reason.status);
    throw buatError('Sesi Download Gate sedang diproses. Silakan coba mulai download lagi.', 409);
  }
  return transaction.snapshot.val();
}

async function cleanupExpiredDownloadSessions(database, limit = 50) {
  const now = Date.now();
  const snapshot = await database.ref(SESSION_PATH)
    .orderByChild('expiresAt')
    .endAt(now)
    .limitToFirst(Math.max(1, Math.min(Number(limit) || 50, 100)))
    .once('value');
  if (!snapshot.exists()) return 0;

  const updates = {};
  snapshot.forEach((child) => {
    updates[child.key] = null;
  });
  const keys = Object.keys(updates);
  if (keys.length) await database.ref(SESSION_PATH).update(updates);
  return keys.length;
}

module.exports = {
  createDownloadSession,
  readDownloadSession,
  consumeDownloadSession,
  cleanupExpiredDownloadSessions
};
