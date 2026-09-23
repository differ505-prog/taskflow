/**
 * Firebase 初始化模組
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from "firebase/firestore";

// ─── Firebase 設定 ───────────────────────────────────────────
// 從環境變數注入，與 .env.local.example 對齊
// 注意：Firebase web config 本身非機密，但移到 env 方便環境分離
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
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
