// ==============================================
// PREMIUM ACCESS — MC ADDON SHARE (STAGE P1)
// Fondasi status Premium. Belum mengubah Download.
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
  const aktif = dicabutPada
    ? false
    : (permanen ? true : Number(sekarang) < berakhir);

  return {
    aktif,
    tipe: data.tipe || null,
    mulai,
    berakhir,
    permanen,
    dicabutPada
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
