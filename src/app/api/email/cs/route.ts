/**
 * VibeList 防禦性客戶成功 Email API
 *
 * 用途：供 Vercel Cron Job 呼叫，批次寄送 CS 郵件
 *
 * Vercel Cron 設定（vercel.json）：
 * {
 *   "crons": [
 *     {
 *       "path": "/api/email/cs?type=weekly_report",
 *       "schedule": "0 17 * * 5"        // 每週五下午 5 點（UTC+8 = 09:00 UTC）
 *     },
 *     {
 *       "path": "/api/email/cs?type=amnestia",
 *       "schedule": "0 10 * * *"         // 每天上午 10 點（UTC+8 = 02:00 UTC）
 *     }
 *   ]
 * }
 *
 * 安全：
 *   - CRON_SECRET header 由 Vercel 自動注入
 *   - production 只接受 Bearer header 與 x-cron-secret header（禁用 query string ?secret=）
 *   - RESEND_API_KEY、RESEND_FROM_EMAIL 純 server-side
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { renderAmnestiaEmail, renderWeeklyReportEmail } from "@/emails";
import { incrementAndCheckQuota } from "@/lib/quota-monitor";

// ─── 環境變數 ────────────────────────────────────────────────────────────

const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "VibeList <noreply@vibelist.app>";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME ?? "VibeList Guild";

// Vercel Cron 自動注入的 secret；本地測試可用 x-cron-secret header
const CRON_SECRET = process.env.CRON_SECRET;

// ─── Lazy client factory ──────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, key);
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

// ─── GET handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── 1. 安全認證 ──
  // Vercel Cron 自動注入 Authorization Bearer header；
  // x-cron-secret header 留作 manual trigger 備援。
  // ⚠️ 禁用 ?secret= query string，避免出現在 Vercel log / CDN / 瀏覽器歷史
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const headerSecret = request.headers.get("x-cron-secret");

  if (process.env.NODE_ENV === "production") {
    if (
      bearerToken !== CRON_SECRET &&
      headerSecret !== CRON_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // dev / preview：保留三通道（bearer + query + header）方便本地測試
    const querySecret = request.nextUrl.searchParams.get("secret");
    if (
      bearerToken !== CRON_SECRET &&
      querySecret !== CRON_SECRET &&
      headerSecret !== CRON_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── 2. 解析 type ────────────────────────────────────────────
  const type = request.nextUrl.searchParams.get("type");

  if (!type || !["amnestia", "weekly_report"].includes(type)) {
    return NextResponse.json(
      { error: "Missing or invalid ?type= (amnestia | weekly_report)" },
      { status: 400 }
    );
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 }
    );
  }

  // ── 3. 分派任務 ────────────────────────────────────────────
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: "Supabase admin not configured", detail: String(err) },
      { status: 500 }
    );
  }

  try {
    const result =
      type === "amnestia"
        ? await sendAmnestiaBatch(supabaseAdmin, resend)
        : await sendWeeklyReportBatch(supabaseAdmin, resend);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error(`[CS Email] ${type} batch failed:`, err);
    return NextResponse.json(
      { error: "Batch send failed", detail: String(err) },
      { status: 500 }
    );
  }
}

// ─── 批次 A：3 天未登入喚回信 ────────────────────────────────────────────

async function sendAmnestiaBatch(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, resend: Resend) {
  const { allowed: resendAllowed } = await incrementAndCheckQuota("resend");
  if (!resendAllowed) {
    console.warn("[CS Email] Resend daily quota exceeded, skipping batch");
    return { sent: 0, skipped: 0, reason: "Resend quota exceeded" };
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: users, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, email")
    .not("email", "is", null)
    .not("email", "eq", "")
    .lt("last_login_at", threeDaysAgo.toISOString())
    .limit(100);

  if (error) throw error;
  if (!users || users.length === 0) {
    return { sent: 0, skipped: 0, reason: "No eligible users" };
  }

  const results = await Promise.allSettled(
    users.map(async (user) => {
      const { html, text } = await renderAmnestiaEmail({
        userName: user.display_name || "朋友",
        lastActiveDays: 3,
      });

      await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: user.email!,
        subject: "沒打開 VibeList 也是一種休息 🍃",
        html,
        text,
      });
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { type: "amnestia", batch_size: users.length, sent, failed };
}

// ─── 批次 B：週末戰報（每週五，僅發給當週活躍用戶） ──────────────────────

async function sendWeeklyReportBatch(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, resend: Resend) {
  const { allowed: resendAllowed } = await incrementAndCheckQuota("resend");
  if (!resendAllowed) {
    console.warn("[CS Email] Resend daily quota exceeded, skipping weekly batch");
    return { sent: 0, skipped: 0, reason: "Resend quota exceeded" };
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date();
  weekEnd.setHours(23, 59, 59, 999);

  const { data: activeUsers, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, email")
    .not("email", "is", null)
    .not("email", "eq", "")
    .gte("last_active_at", weekStart.toISOString())
    .limit(200);

  if (error) throw error;
  if (!activeUsers || activeUsers.length === 0) {
    return { sent: 0, skipped: 0, reason: "No active users this week" };
  }

  const results = await Promise.allSettled(
    activeUsers.map(async (user) => {
      // TODO: 串接 task_history 表，計算 user.id 的本週 PP
      const weekExp = 0;
      const completedCount = 0;
      const usedAiCrusher = false;

      const { html, text } = await renderWeeklyReportEmail({
        userName: user.display_name || "辛苦了！",
        weekPp: weekExp,
        completedTaskCount: completedCount,
        usedAiCrusher,
      });

      await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: user.email!,
        subject: "✨ 你的本週專注戰報來了",
        html,
        text,
      });
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { type: "weekly_report", batch_size: activeUsers.length, sent, failed };
}
