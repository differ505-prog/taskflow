/**
 * Supabase Client 初始化
 *
 * 用途：取代 Firebase Storage 上傳附件到 Supabase Storage bucket
 * Auth / Firestore 仍在 Firebase，storage 只切到 Supabase
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // 在 build 時看不到 env，不 throw；只在 runtime 用到時報錯
  if (typeof window !== "undefined") {
    console.warn(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 未設定，上傳功能將無法運作"
    );
  }
}

let client: SupabaseClient | null = null;

/**
 * 取得 Supabase client（singleton）
 *
 * 用 publishable key（anon 等級），因為瀏覽器端不能持有 service_role
 * Bucket 已設為 public，upload 時 RLS 由 bucket policy 控制
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase 環境變數未設定：請確認 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }
  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // 暫時不接管 auth，Firebase Auth 仍在用
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

export const ATTACHMENTS_BUCKET = "attachments";
