const admin = require('firebase-admin');

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

function normalizeLookup(value) {
  return String(value || '').trim();
}

async function verifyOwner(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const error = new Error('Login diperlukan.');
    error.status = 401;
    throw error;
  }

  const decoded = await admin.auth().verifyIdToken(authHeader.slice(7).trim());
  const roleSnap = await admin.database().ref(`roles/${decoded.uid}`).once('value');
  const role = String(roleSnap.val() || 'user').toLowerCase();
  if (role !== 'owner') {
    const error = new Error('Hanya Owner yang boleh mengelola Admin.');
    error.status = 403;
    throw error;
  }
  return decoded;
}

async function resolveUser(value) {
  const lookup = normalizeLookup(value);
  if (!lookup) throw new Error('Masukkan email atau username akun.');

  if (lookup.includes('@')) {
    return admin.auth().getUserByEmail(lookup.toLowerCase());
  }

  // Akun User biasa dibuat dari username + domain internal MC Addon Share.
  const internalEmail = `${lookup.toLowerCase()}@mcaddon-6c691.firebaseapp.com`;
  return admin.auth().getUserByEmail(internalEmail);
}

async function getRoleMap() {
  const snap = await admin.database().ref('roles').once('value');
  const value = snap.val();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

async function buildStaffList() {
  const roles = await getRoleMap();
  const entries = Object.entries(roles).filter(([, role]) => ['admin', 'owner'].includes(String(role).toLowerCase()));

  const staff = await Promise.all(entries.map(async ([uid, role]) => {
    try {
      const user = await admin.auth().getUser(uid);
      return {
        uid,
        role: String(role).toLowerCase(),
        email: user.email || '',
        disabled: !!user.disabled,
        createdAt: user.metadata?.creationTime || null,
        lastSignIn: user.metadata?.lastSignInTime || null
      };
    } catch (_) {
      return { uid, role: String(role).toLowerCase(), email: '', disabled: null, createdAt: null, lastSignIn: null };
    }
  }));

  return staff.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
    return String(a.email).localeCompare(String(b.email));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });

  try {
    getFirebaseAdmin();
    const owner = await verifyOwner(req);
    const action = String(req.body?.action || '').trim();

    if (action === 'list') {
      return send(res, 200, { ok: true, staff: await buildStaffList() });
    }

    if (action === 'add_admin') {
      const target = await resolveUser(req.body?.identifier);
      if (target.uid === owner.uid) return send(res, 400, { ok: false, error: 'Akun Owner tidak perlu ditambahkan sebagai Admin.' });

      const currentRoleSnap = await admin.database().ref(`roles/${target.uid}`).once('value');
      const currentRole = String(currentRoleSnap.val() || 'user').toLowerCase();
      if (currentRole === 'owner') return send(res, 400, { ok: false, error: 'Akun Owner tidak boleh diubah menjadi Admin.' });

      await admin.database().ref(`roles/${target.uid}`).set('admin');
      return send(res, 200, {
        ok: true,
        action,
        uid: target.uid,
        email: target.email || '',
        message: `${target.email || 'Akun'} sekarang memiliki role Admin.`
      });
    }

    if (action === 'remove_admin') {
      const uid = normalizeLookup(req.body?.uid);
      if (!uid) return send(res, 400, { ok: false, error: 'UID Admin tidak diberikan.' });
      if (uid === owner.uid) return send(res, 400, { ok: false, error: 'Owner tidak dapat menghapus role dirinya sendiri.' });

      const roleSnap = await admin.database().ref(`roles/${uid}`).once('value');
      const role = String(roleSnap.val() || 'user').toLowerCase();
      if (role !== 'admin') return send(res, 400, { ok: false, error: 'Akun tersebut bukan Admin.' });

      await admin.database().ref(`roles/${uid}`).remove();
      return send(res, 200, { ok: true, action, uid, message: 'Role Admin berhasil dicabut. Akun kembali menjadi User.' });
    }

    return send(res, 400, { ok: false, error: 'Aksi tidak dikenal.' });
  } catch (error) {
    console.error('manage-role error:', error);
    let status = Number(error.status) || 500;
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') status = 401;
    if (error.code === 'auth/user-not-found') status = 404;
    return send(res, status, { ok: false, error: error.message || 'Gagal mengelola role Admin.' });
  }
};
