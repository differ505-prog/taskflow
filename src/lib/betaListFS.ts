/**
 * Beta 測試者名單管理
 * - 使用 Firestore `permissions/betas` collection
 * - Admin 可透過 UI 即時新增/移除
 * - 所有裝置透過 onSnapshot 即時同步
 *
 * 文件結構：
 *   permissions/
 *     betas/
 *       {email_lower}/
 *         email: string
 *         addedAt: string (ISO)
 *         addedBy: string (admin uid)
 */
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDB } from "./firebase";

const BETA_COLLECTION = "permissions/betas/emails";

/**
 * 新增 Beta 用戶（Admin 操作）
 */
export async function addBetaUserFS(
  email: string,
  addedByUid: string
): Promise<void> {
  const db = await getFirebaseDB();
  const normalized = email.toLowerCase().trim();
  const docRef = doc(db, BETA_COLLECTION, normalized);
  await setDoc(docRef, {
    email: normalized,
    addedAt: new Date().toISOString(),
    addedBy: addedByUid,
  });
}

/**
 * 移除 Beta 用戶（Admin 操作）
 */
export async function removeBetaUserFS(email: string): Promise<void> {
  const db = await getFirebaseDB();
  const normalized = email.toLowerCase().trim();
  const docRef = doc(db, BETA_COLLECTION, normalized);
  await deleteDoc(docRef);
}

/**
 * 一次讀取所有 Beta 名單（一次性）
 */
export async function getBetaUsersFS(): Promise<string[]> {
  const db = await getFirebaseDB();
  const colRef = collection(db, BETA_COLLECTION);
  return new Promise((resolve) => {
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const emails = snapshot.docs.map((d) => d.data().email as string);
        unsubscribe();
        resolve(emails);
      },
      () => {
        unsubscribe();
        resolve([]);
      }
    );
  });
}

/**
 * 即時訂閱 Beta 名單變動
 * @returns unsubscribe function
 */
export function subscribeBetaUsers(
  callback: (emails: string[]) => void
): Unsubscribe {
  let unsub: Unsubscribe = () => {};
  let active = true;

  getFirebaseDB()
    .then((db) => {
      if (!active) return;
      const colRef = collection(db, BETA_COLLECTION);
      unsub = onSnapshot(
        colRef,
        (snapshot) => {
          const emails = snapshot.docs.map((d) => d.data().email as string);
          callback(emails);
        },
        (error) => {
          console.warn("[BetaList] Snapshot error:", error);
          callback([]);
        }
      );
    })
    .catch(() => {
      if (active) callback([]);
    });

  return () => {
    active = false;
    unsub();
  };
}
