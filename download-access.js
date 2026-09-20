// Stage P8 — Pemeriksaan akses Download.
// Premium aktif, Admin, dan Owner melewati Download Gate.
import { ambilRole } from './auth.js';
import { apakahPremiumAktif } from './premium.js';

export async function cekAksesDownload(user) {
  if (!user?.uid) {
    return { bypass: false, reason: 'guest' };
  }

  try {
    const role = await ambilRole(user);

    if (role === 'owner') {
      return { bypass: true, reason: 'owner', role };
    }

    if (role === 'admin') {
      return { bypass: true, reason: 'admin', role };
    }

    if (await apakahPremiumAktif(user)) {
      return { bypass: true, reason: 'premium', role };
    }

    return { bypass: false, reason: 'user', role };
  } catch (error) {
    console.warn('Gagal memeriksa akses Download:', error);
    // Fail-safe: jika pemeriksaan gagal, jangan memberikan bypass.
    return { bypass: false, reason: 'check-failed', role: 'user' };
  }
}
