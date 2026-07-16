/**
 * Supabase Client 初始化（lazy-init 版本）
 *
 * 用途：
 *   - storageUpload.ts：用 Supabase Storage 取代 Firebase Storage 上傳附件
 *   - sharedSync / personalListSync / personalTaskSync / userProfiles / taskCommentsFS
 *     / betaListFS / sessionCookie：用 Supabase realtime + REST 做共享清單即時同步
 *   - firestore.ts：用 isSupabaseConfigured() 決定是否啟用 supabase 同步路徑
 *
 * Auth / Firestore 仍在 Firebase，storage 只切到 Supabase。
 *
 * 重要：build time 不建立 SupabaseClient。
 *   原因：Next.js prerender 會在 build 時載入所有 module，
 *   若此時 env 還沒注入或缺值，`new SupabaseClient(undefined, ...)` 會 throw
 *   "Invalid supabaseUrl"，整個 build 直接 fail。
 *   解法：module 載入時只檢查 env 存在性，真正的 createClient 延到 runtime。
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 支援兩種命名：Supabase v2 改用 publishable_key，但舊 codebase 仍可能寫 anon_key
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // eslint-disable-next-line no-console
  // 在 build 時看不到 env，不 throw；只在 runtime 用到時報錯
  if (typeof window !== "undefined") {
    console.warn(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL 或 publishable/anon key 未設定，相關功能將無法運作"
    );
  }
}

let cachedClient: SupabaseClient | null = null;

/**
 * 取得 Supabase client（lazy singleton）。
 *
 * 用 publishable key（anon 等級），因為瀏覽器端不能持有 service_role。
 * Bucket 已設為 public，upload 時 RLS 由 bucket policy 控制。
 *
 * 若 env 缺值，回傳 null；呼叫端需自行處理 null 情況（例如 /diag 用 isSupabaseConfigured()）。
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  cachedClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      // 暫時不接管 auth，Firebase Auth 仍在用
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}

/**
 * 向後相容的 named export：早期 8 個 sync 檔案用 `supabase.from(...)` 風格呼叫。
 * 為零呼叫端修改，這裡 export 一個 Proxy：
 *   - 有 client 時行為等同 getSupabaseClient()
 *   - 沒 client 時回傳 null，呼叫端會自己 short-circuit（既有行為）
 */
export const supabase: SupabaseClient | null = getSupabaseClient();

export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_KEY;
}

export const ATTACHMENTS_BUCKET = "attachments";