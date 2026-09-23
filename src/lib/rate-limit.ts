/**
 * src/lib/rate-limit.ts
 *
 * Supabase-backed distributed rate limiter。
 * 替換所有 new Map() in-memory 實作，解決 Vercel serverless 跨實例 bypass 問題。
 *
 * 用法：
 *   import { checkRateLimit } from "@/lib/rate-limit";
 *   const { allowed, remaining, resetAt } = await checkRateLimit("shred:ip:1.2.3.4", 10, 60_000);
 *   if (!allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
 */
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * 檢查是否允許請求。
 *
 * 實作策略：
 *   1. 嘗試呼叫 `rate_limit_increment` RPC（migration 0026 提供）
 *   2. 若 RPC 失敗（未部署 migration），降級為 upsert 方式
 *   3. 若 Supabase 未設定，降級為 always-allow（不阻斷服務）
 *
 * 返回 { allowed, remaining, resetAt }。
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const admin = getAdmin();
  const now = Date.now();

  // 無 Supabase → 無法分散式限速，fail-open 不阻斷用戶
  if (!admin) {
    return { allowed: true, remaining: limit, resetAt: now + windowMs };
  }

  const windowSec = Math.ceil(windowMs / 1000);
  const bucketKey = `rl:${key}`;
  const resetAt = now + windowMs;

  // 嘗試 RPC 方式（最優）
  try {
    const { data } = await admin.rpc("rate_limit_increment", {
      p_key: bucketKey,
      p_limit: limit,
      p_window_sec: windowSec,
    });

    if (data && typeof data === "object" && "allowed" in data) {
      const d = data as { allowed: boolean; remaining: number; reset_at: string };
      return {
        allowed: d.allowed,
        remaining: d.remaining,
        resetAt: new Date(d.reset_at).getTime(),
      };
    }
  } catch {
    // RPC 不存在，降級 upsert 方式
  }

  // 降級：upsert bucket + atomic count
  try {
    const { data: row } = await admin
      .from("rate_limit_buckets")
      .select("count, reset_at")
      .eq("key", bucketKey)
      .maybeSingle();

    if (!row || new Date(row.reset_at).getTime() < now) {
      // 新窗口
      await admin
        .from("rate_limit_buckets")
        .upsert(
          { key: bucketKey, count: 1, reset_at: new Date(resetAt).toISOString() },
          { onConflict: "key" }
        );
      return { allowed: true, remaining: limit - 1, resetAt };
    } else if (row.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: new Date(row.reset_at).getTime() };
    } else {
      await admin
        .from("rate_limit_buckets")
        .update({ count: row.count + 1 })
        .eq("key", bucketKey);
      return {
        allowed: true,
        remaining: limit - row.count - 1,
        resetAt: new Date(row.reset_at).getTime(),
      };
    }
  } catch {
    // DB 錯誤 → fail-open
    return { allowed: true, remaining: limit, resetAt };
  }
}
