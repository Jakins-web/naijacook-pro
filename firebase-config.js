// NaijaCook Pro — Firebase initialization
//
// Fill in your project's config below (same project the ESP32 gateway
// uses — see DATABASE_URL in the ESP32 sketch). Until you do, the app
// runs in Demo mode: the UI works fully but nothing reaches a real
// machine, so it's safe to develop and preview without credentials.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyACpFWnl3jJ1TFDR0JLlZ4OSjoMoDYk358",
  authDomain: "naijacook-pro.firebaseapp.com",
  databaseURL: "https://naijacook-pro-default-rtdb.firebaseio.com",
  projectId: "naijacook-pro",
  storageBucket: "naijacook-pro.firebasestorage.app",
  messagingSenderId: "169789344566",
  appId: "1:169789344566:web:0aedd0d9dd7d4aa2ea0197",
  measurementId: "G-63TJZSSTLT"
};

export const DEMO_MODE = !firebaseConfig.databaseURL;

let db = null;
let auth = null;
// Resolves once anonymous sign-in completes -- app.js awaits this before
// its first read/write, so a permission-denied never races an open rule.
export let authReady = Promise.resolve();

if (!DEMO_MODE) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);
  authReady = new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => { if (user) resolve(user); });
    signInAnonymously(auth).catch((err) => console.error("Anonymous sign-in failed:", err));
  });
}

export { db, ref, set, onValue };
