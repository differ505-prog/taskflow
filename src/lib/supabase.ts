import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getAuth, onIdTokenChanged } from "firebase/auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Shared list realtime sync will be disabled."
  );
}

/**
 * Supabase client used for shared-list realtime sync.
 *
 * Auth model:
 *  - REST (PostgREST): 用 `accessToken` getter 自動從 firebase currentUser 取得 ID token。
 *  - Realtime (WebSocket): 不會自動呼叫 getter，因此另外用 `onIdTokenChanged` 監聽，
 *    並在 token 刷新時主動呼叫 supabase.realtime.setAuth(token)。
 *
 *  RLS 用 `auth.uid()::text` 與 firebase uid 比對；安全敏感操作透過 security-definer RPC。
 */

function makeOptions() {
  return {
    realtime: { params: { eventsPerSecond: 10 } },
    accessToken: async () => {
      try {
        const u = getAuth().currentUser;
        return u ? await u.getIdToken() : null;
      } catch {
        return null;
      }
    },
    global: {
      headers: { "x-client-source": "vibelist-web" },
    },
  } as const;
}

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, makeOptions() as any) : null;

export function isSupabaseConfigured(): boolean {
  return !!supabase;
}

/**
 * 把 Firebase ID token 主動同步到 Supabase Realtime WebSocket。
 * Firebase ID token 預設 1 小時過期；realtime 不會自動 refresh accessToken getter，
 * 所以登入 / token 變動必須主動呼叫此 helper。
 */
export async function refreshSupabaseRealtimeAuth(): Promise<void> {
  if (!supabase) return;
  try {
    const u = getAuth().currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    const rt = supabase.realtime as any;
    if (typeof rt.setAuth === "function") {
      await rt.setAuth(token);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Supabase] refreshRealtimeAuth failed:", err);
  }
}

/**
 * 在 App boot 時呼叫一次：把 onIdTokenChanged 綁到 refreshSupabaseRealtimeAuth，
 * AuthContext 也會在登入 / 切換時主動呼叫一次。
 */
export function bindSupabaseAuthRefresher(): () => void {
  try {
    const auth = getAuth();
    return onIdTokenChanged(auth, () => {
      void refreshSupabaseRealtimeAuth();
    });
  } catch {
    return () => {};
  }
}
