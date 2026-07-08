"use client";

/**
 * Session cookie 管理
 *
 * - 登入後：呼叫 exchangeIdTokenForSessionCookie() 拿到 HttpOnly cookie
 * - 登出時：呼叫 clearSessionCookie()
 * - 透過 fetch() 自動帶上 cookie（credentials: 'include'）
 *
 * ⚠️ 這個機制對 Supabase Realtime 是**輔助**用的。
 *    Supabase RLS 仍然以 firebase ID token 為主，這層只是再加一道防線。
 */

/**
 * 把當前 Firebase ID token 換成 14 天 HttpOnly cookie
 */
export async function exchangeIdTokenForSessionCookie(idToken: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[session] exchange failed:", err);
    return false;
  }
}

/**
 * 清除 HttpOnly cookie
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    await fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "include",
    });
  } catch (err) {
    console.warn("[session] clear failed:", err);
  }
}