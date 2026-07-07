/**
 * Firebase 初始化模組
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence, connectFirestoreEmulator } from "firebase/firestore";

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
    try {
      auth = getAuth(getFirebaseApp());
    } catch (error) {
      console.error("[Firebase] Auth initialization error:", error);
      throw error;
    }
  }
  return auth;
}

// Eagerly initialize Firestore DB in the background so it's ready before the first async call
let dbInitPromise: Promise<Firestore> | null = null;

export async function getFirebaseDB(): Promise<Firestore> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    db = getFirestore(getFirebaseApp());
    // 啟用 IndexedDB 離線持久化（支援飛航模式）
    try {
      await enableMultiTabIndexedDbPersistence(db);
    } catch (err: any) {
      if (err.code === "failed-precondition") {
        // 多分頁衝突，稍後重試
      } else if (err.code === "unimplemented") {
        // 瀏覽器不支援，退而求其次用單一分頁持久化
        try {
          await enableIndexedDbPersistence(db);
        } catch {
          // 完全不支援，就算了
        }
      }
    }
    return db;
  })();

  return dbInitPromise;
}

export { getFirebaseApp as initializeFirebase };
