// ==============================================
// PREMIUM ACCESS — MC ADDON SHARE (STAGE P5)
// Status Premium otomatis mengikuti waktu kedaluwarsa. Dipakai juga untuk tampilan Profil. Belum mengubah Download.
// ==============================================
import { db } from "./auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

/**
 * Mengambil data Premium milik UID tertentu.
 * Hanya gunakan untuk UID milik user yang sedang login pada sisi browser.
 */
export async function ambilDataPremium(uid) {
  if (!uid) return null;

  try {
    const snapshot = await get(ref(db, `premium/${uid}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error("Gagal membaca data Premium:", error);
    return null;
  }
}

function tipoPermanen(tipe, berakhir) {
  return tipe === "permanen" || berakhir === null;
}

/**
 * Status Premium dihitung dari waktu saat ini.
 * Tidak perlu menghapus data ketika Premium kedaluwarsa.
 */
export function statusPremium(data, sekarang = Date.now()) {
  if (!data || typeof data !== "object") {
    return {
      aktif: false,
      tipe: null,
      mulai: null,
      berakhir: null,
      permanen: false
    };
  }

  const tipe = String(data.tipe || "").toLowerCase();
  const mulai = Number(data.mulai) || null;
  const berakhir = data.berakhir === null || data.berakhir === undefined || data.berakhir === ""
    ? null
    : Number(data.berakhir) || null;

  const dicabutPada = data.dicabutPada === null || data.dicabutPada === undefined || data.dicabutPada === ""
    ? null
    : Number(data.dicabutPada) || null;
  const permanen = tipoPermanen(tipe, berakhir);
  const kadaluarsa = !permanen && !dicabutPada && Number.isFinite(berakhir) && Number(sekarang) >= berakhir;
  const aktif = dicabutPada
    ? false
    : (permanen ? true : !kadaluarsa);
  const sisaMs = aktif && !permanen && Number.isFinite(berakhir)
    ? Math.max(0, berakhir - Number(sekarang))
    : null;

  return {
    aktif,
    kadaluarsa,
    tipe: data.tipe || null,
    mulai,
    berakhir,
    permanen,
    dicabutPada,
    sisaMs
  };
}

/**
 * Helper praktis untuk halaman yang hanya membutuhkan true/false.
 */
export async function apakahPremiumAktif(user) {
  if (!user?.uid) return false;
  const data = await ambilDataPremium(user.uid);
  return statusPremium(data).aktif;
}
