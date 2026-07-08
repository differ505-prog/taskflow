/**
 * betaListFS.ts — Beta 測試者名單雙軌存儲層
 *
 * 策略：
 * - Supabase (primary)：寫入 beta_users 表，所有已登入者即時讀取
 * - Firebase (legacy)：繼續讀取舊有 Firestore permissions/betas/emails
 *
 * 兩邊合併去重（以 Supabase 為準），確保 role 判定完全脫離 Firebase。
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
import { supabase, isSupabaseConfigured } from "./supabase";

// ─── Firestore path ────────────────────────────────────────────────────
const BETA_FIRESTORE_PATH = "permissions/betas/emails";

// ─── Firestore helpers ────────────────────────────────────────────────
async function getFirestoreBetaEmails(): Promise<string[]> {
  try {
    const db = await getFirebaseDB();
    const colRef = collection(db, BETA_FIRESTORE_PATH);
    return new Promise((resolve) => {
      const unsub = onSnapshot(
        colRef,
        (snap) => {
          unsub();
          resolve(snap.docs.map((d) => (d.data() as { email?: string }).email ?? "").filter(Boolean));
        },
        () => {
          unsub();
          resolve([]);
        }
      );
    });
  } catch {
    return [];
  }
}

async function addFirestoreBeta(email: string, addedByUid: string): Promise<void> {
  const db = await getFirebaseDB();
  const normalized = email.toLowerCase().trim();
  const docRef = doc(db, BETA_FIRESTORE_PATH, normalized);
  await setDoc(docRef, {
    email: normalized,
    addedAt: new Date().toISOString(),
    addedBy: addedByUid,
  });
}

async function removeFirestoreBeta(email: string): Promise<void> {
  const db = await getFirebaseDB();
  const normalized = email.toLowerCase().trim();
  const docRef = doc(db, BETA_FIRESTORE_PATH, normalized);
  await deleteDoc(docRef);
}

// ─── Supabase helpers ─────────────────────────────────────────────────
async function getSupabaseBetaEmails(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase!
      .from("beta_users")
      .select("email")
      .order("added_at", { ascending: true });
    if (error || !data) return [];
    return (data as { email: string }[]).map((r) => r.email);
  } catch {
    return [];
  }
}

// ─── Dual-source subscribe ────────────────────────────────────────────
/**
 * 即時訂閱 Beta 名單
 * @returns unsubscribe function
 */
export function subscribeBetaUsers(
  callback: (emails: string[]) => void
): Unsubscribe {
  let unsubFirebase: Unsubscribe = () => {};
  let fbEmails: string[] = [];
  let sbEmails: string[] = [];
  let fbReady = false;
  let active = true;

  function emit() {
    if (!active) return;
    // 合併去重，Supabase 為準
    const merged = Array.from(new Set([...sbEmails, ...fbEmails]));
    callback(merged);
  }

  // Firebase legacy 即時訂閱
  if (isSupabaseConfigured()) {
    getFirebaseDB()
      .then((db) => {
        if (!active) return;
        const colRef = collection(db, BETA_FIRESTORE_PATH);
        unsubFirebase = onSnapshot(
          colRef,
          (snap) => {
            fbEmails = snap.docs
              .map((d) => (d.data() as { email?: string }).email ?? "")
              .filter(Boolean);
            fbReady = true;
            emit();
          },
          () => {
            fbEmails = [];
            emit();
          }
        );
      })
      .catch(() => {
        if (active) callback(sbEmails);
      });
  }

  // Supabase 即時訂閱（primary）
  if (isSupabaseConfigured()) {
    const channel = supabase!
      .channel("beta_users_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beta_users" },
        () => {
          void getSupabaseBetaEmails().then((emails) => {
            sbEmails = emails;
            emit();
          });
        }
      )
      .subscribe();

    // 初次載入
    void getSupabaseBetaEmails().then((emails) => {
      sbEmails = emails;
      emit();
    });

    return () => {
      active = false;
      unsubFirebase();
      supabase!.removeChannel(channel);
    };
  }

  // 純 Firebase fallback（Supabase 未配置時）
  void getFirestoreBetaEmails().then((emails) => {
    fbEmails = emails;
    emit();
  });

  return () => {
    active = false;
    unsubFirebase();
  };
}

/**
 * 新增 Beta 用戶（Admin 操作）
 * - Supabase 已配置：寫入 beta_users 表
 * - 否則 fallback 到 Firebase
 */
export async function addBetaUserFS(
  email: string,
  addedByUid: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase!.rpc("add_beta_user", { p_email: email });
  } else {
    await addFirestoreBeta(email, addedByUid);
  }
}

/**
 * 移除 Beta 用戶（Admin 操作）
 * - Supabase 已配置：從 beta_users 表刪除
 * - 否則 fallback 到 Firebase
 */
export async function removeBetaUserFS(email: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase!.rpc("remove_beta_user", { p_email: email });
  } else {
    await removeFirestoreBeta(email);
  }
}

/**
 * 一次讀取所有 Beta 名單（一次性，給非即時場景用）
 */
export async function getBetaUsersFS(): Promise<string[]> {
  const sb = isSupabaseConfigured() ? await getSupabaseBetaEmails() : [];
  const fb = await getFirestoreBetaEmails();
  return Array.from(new Set([...sb, ...fb]));
}
