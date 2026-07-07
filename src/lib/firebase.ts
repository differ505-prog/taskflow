/**
 * Firebase 初始化模組
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// ─── Firebase 設定 ───────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD2yBIIUzRdwvwr_ApEYjAR4ujF-jaX4cs",
  authDomain: "taskflow-1fbd3.firebaseapp.com",
  projectId: "taskflow-1fbd3",
  storageBucket: "taskflow-1fbd3.firebasestorage.app",
  messagingSenderId: "942619428359",
  appId: "1:942619428359:web:5718c6891b624a397b8ca2",
  measurementId: "G-36ELNFZNZD",
};

// ─── Singleton 初始化 ────────────────────────────────────────
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseDB(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export { getFirebaseApp as initializeFirebase };
