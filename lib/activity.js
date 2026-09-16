const admin = require('firebase-admin');
function getActorLabel(decoded) {
  const email = String(decoded?.email || '').trim();
  if (!email) return String(decoded?.uid || 'akun');
  return email.split('@')[0];
}
async function catatAktivitas({ decoded, role, aksi, targetId = '', targetName = '', detail = '' }) {
  try {
    const ref = admin.database().ref('aktivitas').push();
    await ref.set({
      waktu: Date.now(), uid: String(decoded?.uid || ''), actor: getActorLabel(decoded),
      role: String(role || 'user').toLowerCase(), aksi: String(aksi || '').slice(0, 40),
      targetId: String(targetId || '').slice(0, 120), targetName: String(targetName || '').slice(0, 160),
      detail: String(detail || '').slice(0, 300)
    });
  } catch (error) { console.warn('Gagal mencatat aktivitas:', error?.message || error); }
}
module.exports = { catatAktivitas, getActorLabel };
