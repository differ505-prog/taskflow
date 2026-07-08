/**
 * Firebase Admin SDK (server-side only)
 *
 * 用於：
 *   1. 驗證 client 傳來的 ID token
 *   2. 簽發 HttpOnly Session Cookie
 *   3. 將 session cookie 反查為使用者
 *
 * ⚠️ 只能在 server side 使用 (API Routes)，不可 import 到 "use client" 元件
 */
import "server-only";
import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth as getAdminAuth, Auth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

let adminApp: App | undefined;

export function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[FirebaseAdmin] Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars"
    );
  }
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
  } else {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return adminApp;
}

export function getFirebaseAdminAuth(): Auth {
  return getAdminAuth(getAdminApp());
}