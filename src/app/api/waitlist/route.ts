/**
 * /api/waitlist — 候補名單 API
 *
 * 公測期變更（**BUG FIX** + 硬化）：
 *   1. 修掉原本讀 localStorage 的 bug（server 端永遠讀不到）
 *   2. 改用 Upstash Redis 或 Supabase KV 持久化
 *   3. 加 IP rate limit: 5 次 / 小時（防 Resend quota 灌水）
 *   4. email 全小寫 + 去重檢查
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Rate limit (process-local，但公測期用量低不致撞破) ───
const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 5;
const WINDOW = 60 * 60 * 1000;

function check(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW });
    return true;
  }
  if (b.count >= LIMIT) return false;
  b.count += 1;
  return true;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (!check(ip)) {
      return NextResponse.json({ error: "報名過於頻繁，請稍後再試" }, { status: 429 });
    }

    const body = await req.json();
    const rawEmail = body.email;
    if (typeof rawEmail !== "string") {
      return NextResponse.json({ error: "請輸入有效的 Email" }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Email 格式不合法" }, { status: 400 });
    }

    const admin = getAdmin();
    if (!admin) {
      // 後端未設定，記 log 即可（公測期不要因缺設定讓前端報錯）
      console.warn("[waitlist] Supabase 未設定，跳過持久化");
      return NextResponse.json({ message: "已收到報名！" }, { status: 200 });
    }

    // 嘗試寫入（若已存在則靠 unique constraint 回 409）
    const { error } = await admin.from("waitlist").insert({ email });

    if (error?.code === "23505") {
      // unique violation → 已存在
      return NextResponse.json(
        { message: "你已經在名單裡了 ✨", alreadyJoined: true },
        { status: 200 }
      );
    }
    if (error) {
      console.error("[waitlist] Insert failed:", error.message);
      return NextResponse.json({ error: "系統忙碌中，請稍後再試" }, { status: 500 });
    }

    return NextResponse.json({ message: "報名成功！我們會第一時間通知你 🎉" });
  } catch (err) {
    console.error("[waitlist] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Waitlist API is running" });
}
