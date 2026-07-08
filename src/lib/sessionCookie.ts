"use client";

/**
 * Session cookie 管理 — Supabase SSR 版
 *
 * Supabase Auth (@supabase/ssr) 自動處理 HttpOnly session cookie：
 * - 登入後：createBrowserClient 自動寫入 cookie
 * - 登出時：supabase.auth.signOut() 自動清除 cookie
 * - server 端：createServerClient 自動讀取 cookie
 *
 * 此模組作為薄的 wrapper，在需要明確操作時使用。
 * 實質工作已由 @supabase/ssr 代勞。
 */
import { supabase } from "./supabase";

/**
 * 觸發一次 session refresh（等同於呼叫一次 getSession）
 * 目前無需使用，Supabase client 會自動刷新。
 */
export async function refreshSession(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  void data;
}

/**
 * 清除 session（等同於 signOut）
 */
export async function clearSession(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
