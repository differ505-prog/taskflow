/**
 * quota-monitor.ts — API Key 用量監控
 *
 * 公測期必備：在 Gemini / Resend 用量接近警戒線時主動告警 Discord。
 * 使用 Supabase 作為 counter store（每 API 每日一列），
 * 不需引入 Upstash Redis 或其他外部依賴。
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GEMINI_DAILY_LIMIT = 50_000;  // Gemini Free tier = 15 req/min, 月 ~1.5M；警告線設 50K/day
const RESEND_DAILY_LIMIT = 90;       // Resend Free = 100/day，警告線設 90（90%）
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL_FOR_QUOTA; // 需加到 Vercel env

async function getAdmin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function incrementAndCheckQuota(
  service: "gemini" | "resend"
): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10); // "2026-09-23"
  const admin = await getAdmin();

  // 查今日 counter 列
  const { data: row } = await admin
    .from("quota_counters")
    .select("count")
    .eq("service", service)
    .eq("date", today)
    .single();

  const currentCount = row?.count ?? 0;
  const limit = service === "gemini" ? GEMINI_DAILY_LIMIT : RESEND_DAILY_LIMIT;

  if (currentCount >= limit) {
    return { allowed: false, currentCount, limit };
  }

  // increment：若列不存在 upsert 為 1，否則 count + 1
  const newCount = currentCount + 1;
  await admin
    .from("quota_counters")
    .upsert(
      { service, date: today, count: newCount },
      { onConflict: "service,date" }
    );

  // 警告：>= 80% 且為 100 的倍數（避免 spam）
  if (newCount >= limit * 0.8 && newCount % 100 === 0) {
    void warnDiscord(service, newCount, limit);
  }

  return { allowed: true, currentCount: newCount, limit };
}

async function warnDiscord(service: string, count: number, limit: number) {
  if (!DISCORD_WEBHOOK_URL) return;
  const pct = Math.round((count / limit) * 100);
  await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `⚠️ **[${service}] 用量警告**：${count}/${limit} (${pct}%) — 公測期監控，請確認是否異常`,
    }),
  });
}
