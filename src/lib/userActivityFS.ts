/**
 * 用戶活躍度追蹤
 * - lastLoginAt: 登入時更新
 * - lastActiveAt: 完成任務 / 建立任務 / 儲存清單等有意義動作時更新
 *
 * 文件結構：users/{uid}/meta/profile
 *   - email
 *   - lastLoginAt  (ISO string)
 *   - lastActiveAt (ISO string)
 *   - createdAt    (ISO string)
 */
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getFirebaseDB } from "./firebase";

/**
 * 確保 profile 文件存在（首次登入時建立）
 */
export async function ensureUserProfile(args: {
  uid: string;
  email: string;
}): Promise<void> {
  try {
    const db = await getFirebaseDB();
    const ref = doc(db, "users", args.uid, "meta", "profile");
    const snap = await getDoc(ref);
    const now = new Date().toISOString();
    if (!snap.exists()) {
      await setDoc(ref, {
        email: args.email,
        createdAt: now,
        lastLoginAt: now,
        lastActiveAt: now,
      });
    } else {
      // 已存在 → 只更新 lastLoginAt
      await updateDoc(ref, { lastLoginAt: now });
    }
  } catch (err) {
    // 不要阻斷登入流程
    console.warn("[UserActivity] ensureUserProfile failed:", err);
  }
}

/**
 * 記錄登入時間（給 AuthContext 呼叫）
 */
export async function recordLogin(uid: string): Promise<void> {
  try {
    const db = await getFirebaseDB();
    const ref = doc(db, "users", uid, "meta", "profile");
    const now = new Date().toISOString();
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { lastLoginAt: now, lastActiveAt: now });
    } else {
      await setDoc(ref, { lastLoginAt: now, lastActiveAt: now, createdAt: now });
    }
  } catch (err) {
    console.warn("[UserActivity] recordLogin failed:", err);
  }
}

/**
 * 記錄活躍時間（給任務 / 清單 / 習慣等寫入時呼叫）
 * 用節流避免每個動作都寫入
 */
const lastActiveWriteAt = new Map<string, number>();
const ACTIVE_THROTTLE_MS = 30_000; // 30 秒內最多寫一次

export async function recordActive(uid: string): Promise<void> {
  const now = Date.now();
  const last = lastActiveWriteAt.get(uid) ?? 0;
  if (now - last < ACTIVE_THROTTLE_MS) return;
  lastActiveWriteAt.set(uid, now);

  try {
    const db = await getFirebaseDB();
    const ref = doc(db, "users", uid, "meta", "profile");
    const ts = new Date().toISOString();
    await updateDoc(ref, { lastActiveAt: ts });
  } catch (err) {
    console.warn("[UserActivity] recordActive failed:", err);
  }
}