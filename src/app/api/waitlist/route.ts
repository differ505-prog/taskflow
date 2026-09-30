/**
 * /api/waitlist — 候補名單 API
 *
 * 公測期變更（**BUG FIX** + 硬化）：
 *   1. 修掉原本讀 localStorage 的 bug（server 端永遠讀不到）
 *   2. 改用 Upstash Redis 或 Supabase KV 持久化
 *   3. 加 IP rate limit: 5 次 / 小時（防 Resend quota 灌水）
 *   4. email 全小寫 + 去重檢查
 *   5. Cloudflare Turnstile 人機驗證（防 bot 無限灌報名）
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Cloudflare Turnstile 驗證 ───────────────────────────────────────────────
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // 未設定 Turnstile（dev 環境），跳過驗證
    console.warn("[waitlist] TURNSTILE_SECRET_KEY not configured, skipping verification");
    return true;
  }
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
          remoteip: ip,
        }),
      }
    );
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // 1. Rate limit
    const { allowed } = await checkRateLimit(`waitlist:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "報名過於頻繁，請稍後再試" }, { status: 429 });
    }

    const body = await req.json();

    // 2. Turnstile 驗證
    const cfTurnstile = body.cfTurnstile;
    if (typeof cfTurnstile !== "string" || !cfTurnstile) {
      return NextResponse.json({ error: "請先完成人機驗證" }, { status: 403 });
    }
    const verified = await verifyTurnstile(cfTurnstile, ip);
    if (!verified) {
      console.warn("[waitlist] Turnstile verification failed");
      return NextResponse.json({ error: "人機驗證失敗，請稍後重試" }, { status: 403 });
    }

    // 3. Email 解析與驗證
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
      console.warn("[waitlist] Supabase 未設定，跳過持久化");
      return NextResponse.json({ message: "已收到報名！" }, { status: 200 });
    }

    const { error } = await admin.from("waitlist").insert({ email });

    if (error?.code === "23505") {
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
