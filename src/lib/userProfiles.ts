/**
 * userProfiles.ts — Supabase 個人資料層（取代 Firebase Firestore userActivityFS）
 *
 * 功能：
 * - upsertProfile：首次登入建立 / 之後更新 last_login_at（自動計算 role）
 * - updateLastActive：完成任務等有意義動作時更新 last_active_at（client 端負責節流）
 * - getProfile：讀取指定用戶資料（含 role）
 * - getRole：快速查詢指定用戶的 role
 *
 * 全部透過 Supabase RPC 執行，繞過 RLS（因 RPC 為 security definer）。
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { UserRole } from "./types";

/**
 * Upsert 使用者 profile（首登建立，之後更新 last_login_at）
 * role 由後端自動計算：auth metadata is_admin → admin，否則 free
 * beta 需透過 setUserRole RPC 手動設定
 */
export async function upsertProfile(args: {
  uid: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.rpc("upsert_profile", {
      p_uid: args.uid,
      p_email: args.email,
      p_display_name: args.displayName ?? null,
      p_avatar_url: args.avatarUrl ?? null,
    });
  } catch (err) {
    console.warn("[userProfiles] upsertProfile failed:", err);
  }
}

/**
 * 更新 last_active_at（呼叫方應自行控制節流）
 */
export async function updateLastActive(uid: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.rpc("update_last_active", { p_uid: uid });
  } catch (err) {
    console.warn("[userProfiles] updateLastActive failed:", err);
  }
}

/**
 * 取得指定用戶 profile
 */
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  createdAt: string | null;
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.rpc("get_profile", { p_uid: uid });
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      uid: row.uid,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      role: (row.role as UserRole) ?? "free",
      lastLoginAt: row.last_login_at,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
    };
  } catch (err) {
    console.warn("[userProfiles] getProfile failed:", err);
    return null;
  }
}

/**
 * 快速查詢指定用戶的 role
 */
export async function getRole(uid: string): Promise<UserRole> {
  if (!isSupabaseConfigured()) return "free";
  try {
    const { data, error } = await supabase.rpc("get_user_role", { p_uid: uid });
    if (error || !data) return "free";
    return (data as string) as UserRole;
  } catch {
    return "free";
  }
}

/**
 * Admin 將指定用戶設為 beta 或 free（只能 admin 操作）
 */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { error } = await supabase.rpc("set_user_role", {
      p_uid: uid,
      p_role: role,
    });
    if (error) {
      console.warn("[userProfiles] setUserRole failed:", error.message);
    }
  } catch (err) {
    console.warn("[userProfiles] setUserRole failed:", err);
  }
}
