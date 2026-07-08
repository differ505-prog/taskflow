/**
 * Supabase client — v2（Supabase Auth 統一版）
 *
 * Auth model：
 * - 所有 auth 走 Supabase Auth（Google OAuth / Email）
 * - client 用 @supabase/ssr createBrowserClient，自動處理 cookie
 * - RLS 用 Supabase JWT（uid 為 Supabase user id）
 * - Realtime 自動使用同一個 session token
 *
 * Firebase 仍用於：個人任務/清單/習慣/標籤/番茄鐘的 Firestore 同步。
 */
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Shared list realtime sync will be disabled."
  );
}

/**
 * Client-side Supabase client（用於 shared list realtime sync）
 * 使用 @supabase/ssr 自動管理 session cookie。
 */
export const supabase = url && anonKey
  ? createBrowserClient(url, anonKey)
  : null;

export function isSupabaseConfigured(): boolean {
  return !!supabase;
}
