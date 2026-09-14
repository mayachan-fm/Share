// ==============================================
// FIREBASE AUTH + ROLE — MC ADDON SHARE
// ==============================================
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSVDvod7D4-KJ4zXJq_HW0woxUzEhmEY",
  authDomain: "mcaddon-6c691.firebaseapp.com",
  databaseURL: "https://mcaddon-6c691-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mcaddon-6c691",
  storageBucket: "mcaddon-6c691.firebasestorage.app",
  messagingSenderId: "769674524186",
  appId: "1:769674524186:web:05e8c5f4e34867980b03a3",
  measurementId: "G-X9Q5VPSPTD"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Auth persistence:", error);
});

// User biasa tetap memakai username.
// Admin/Owner memakai email Firebase asli.
const DOMAIN_INTERNAL = "@mcaddon-6c691.firebaseapp.com";

export function normalisasiUsername(username) {
  return username.trim();
}

export function validasiUsername(username) {
  return /^[A-Za-z0-9_]{3,20}$/.test(username);
}

export function usernameKeEmail(username) {
  return `${username.toLowerCase()}${DOMAIN_INTERNAL}`;
}

export function emailKeUsername(email) {
  if (!email) return "";
  return email.split("@")[0];
}

/*
  Struktur role:
  roles/
    UID_USER: "user"
    UID_ADMIN: "admin"
    UID_OWNER: "owner"

  User biasa tidak perlu ditulis ke node roles.
  Jika UID tidak ditemukan, sistem otomatis menganggapnya "user".

  Admin/Owner akan kita daftarkan secara manual melalui Firebase
  pada tahap konfigurasi akun staf.
*/
export async function ambilRole(user) {
  if (!user) return "guest";

  try {
    const snapshot = await get(ref(db, `roles/${user.uid}`));
    const role = snapshot.exists() ? String(snapshot.val()).toLowerCase() : "user";

    if (["user", "admin", "owner"].includes(role)) return role;
    return "user";
  } catch (error) {
    console.error("Gagal membaca role:", error);
    // Fail-safe: jika role gagal dibaca, jangan beri hak istimewa.
    return "user";
  }
}

export function punyaHakAdmin(role) {
  return role === "admin" || role === "owner";
}

export function adalahOwner(role) {
  return role === "owner";
}

export {
  app,
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
};
