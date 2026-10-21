// ==============================================
// PREMIUM UI — MC ADDON SHARE
// Helper tampilan untuk fitur Premium: badge, tema eksklusif, cek status.
// ==============================================
import { db } from "./auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { statusPremium } from "./premium.js";

// Daftar tema. premium:false = gratis, premium:true = khusus Premium.
export const DAFTAR_TEMA = [
  { id: "default", nama: "Default", premium: false, ikon: "fa-circle", warna: "#5D9C41" },
  { id: "gelap", nama: "Ultra Gelap", premium: false, ikon: "fa-moon-o", warna: "#111111" },
  { id: "nether", nama: "Nether 🔥", premium: true, ikon: "fa-fire", warna: "#ff5a36" },
  { id: "end", nama: "The End 🌌", premium: true, ikon: "fa-magic", warna: "#a855f7" },
  { id: "emerald", nama: "Emerald 💎", premium: true, ikon: "fa-gem", warna: "#10b981" }
];

export function terapkanTema(id) {
  const html = document.documentElement;
  DAFTAR_TEMA.forEach((t) => html.classList.remove("tema-" + t.id));
  if (id && id !== "default") html.classList.add("tema-" + id);
  try { localStorage.setItem("tema-mcaddon", id || "default"); } catch (e) {}
}

export function muatTemaTersimpan() {
  try { return localStorage.getItem("tema-mcaddon") || "default"; } catch (e) { return "default"; }
}

// HTML badge mahkota Premium. Sisipkan di samping username.
export function badgePremiumHtml(extraClass = "") {
  return `<span class="badge-premium ${extraClass}" title="Pengguna Premium"><i class="fa fa-crown"></i></span>`;
}

// Cache set UID yang sedang Premium aktif (untuk badge di komentar).
let _setPremium = null;
let _sedangMemuat = null;
export async function ambilSetPremiumUid() {
  if (_setPremium) return _setPremium;
  if (!_sedangMemuat) {
    _sedangMemuat = (async () => {
      const set = new Set();
      try {
        const snap = await get(ref(db, "premium"));
        if (snap.exists()) {
          snap.forEach((child) => {
            if (statusPremium(child.val()).aktif) set.add(child.key);
          });
        }
      } catch (e) { console.warn("Gagal memuat daftar Premium:", e); }
      _setPremium = set;
      return set;
    })();
  }
  return _sedangMemuat;
}

export function apakahUidPremiumSync(uid) {
  return !!(_setPremium && uid && _setPremium.has(uid));
}
