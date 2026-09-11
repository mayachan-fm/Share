// ==============================================
// FIREBASE AUTH — MC ADDON SHARE
// Firebase SDK dimuat melalui CDN resmi Google.
// ==============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSVDvod7D4K-JJ4zXJq_HW0woxUzEhmEY",
  authDomain: "mcaddon-6c691.firebaseapp.com",
  databaseURL: "https://mcaddon-6c691-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mcaddon-6c691",
  storageBucket: "mcaddon-6c691.firebasestorage.app",
  messagingSenderId: "769674524186",
  appId: "1:769674524186:web:05e8c5f4e34867980b03a3",
  measurementId: "G-X9Q5VPSPTD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Simpan sesi login di browser.
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Auth persistence:", error);
});

// Firebase Email/Password memerlukan format email.
// Pengguna tetap hanya melihat dan mengisi username di website.
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

export {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
};
