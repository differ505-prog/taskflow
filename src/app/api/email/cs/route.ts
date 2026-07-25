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
 * 安全：需附上 CRON_SECRET Header（由 Vercel 自動注入）對外防護
 * 環境變數：
 *   RESEND_API_KEY        — Resend API Key
 *   RESEND_FROM_EMAIL     — 寄件人地址（如 noreply@vibelist.app）
 *   RESEND_FROM_NAME      — 寄件人名稱（如 VibeList Guild）
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { renderAmnestiaEmail, renderWeeklyReportEmail } from "@/emails";

// ─── 環境變數 ────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "VibeList <noreply@vibelist.app>";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME ?? "VibeList Guild";

// Vercel Cron 自動注入的 secret；本地測試可用 ?secret=xxx 蓋過
const CRON_SECRET = process.env.CRON_SECRET;

// ─── Supabase Admin Client（讀取 user 資料） ─────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Resend Client ───────────────────────────────────────────────────────

const resend = RESEND_API_KEY
  ? new Resend(RESEND_API_KEY)
  : null;

// ─── GET handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── 1. 安全認證 ────────────────────────────────────────────
  const providedSecret = request.nextUrl.searchParams.get("secret");
  if (process.env.NODE_ENV === "production" && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. 解析 type ────────────────────────────────────────────
  const type = request.nextUrl.searchParams.get("type");

  if (!type || !["amnestia", "weekly_report"].includes(type)) {
    return NextResponse.json(
      { error: "Missing or invalid ?type= (amnestia | weekly_report)" },
      { status: 400 }
    );
  }

  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 }
    );
  }

  // ── 3. 分派任務 ────────────────────────────────────────────
  try {
    const result =
      type === "amnestia"
        ? await sendAmnestiaBatch()
        : await sendWeeklyReportBatch();

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

async function sendAmnestiaBatch() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // 抓 3 天內完全沒登入、但帳號存在且有 email 的用戶
  // 假設用戶資料存在 profiles 表
  const { data: users, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, email")
    .not("email", "is", null)
    .not("email", "eq", "")
    // last_login_at 在 3 天前之前（意味著 3 天沒上）
    .lt("last_login_at", threeDaysAgo.toISOString())
    .limit(100); // 每批次最多 100 封，防 API rate limit

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

      await resend!.emails.send({
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

  return {
    type: "amnestia",
    batch_size: users.length,
    sent,
    failed,
  };
}

// ─── 批次 B：週末戰報（每週五，僅發給當週活躍用戶） ──────────────────────

async function sendWeeklyReportBatch() {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 6); // 本週一
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(); // 今天（週五）
  weekEnd.setHours(23, 59, 59, 999);

  // 抓本週有任務更新的用戶（profiles + 任務表跨查）
  // 假設有一張 task_logs 或 task_history 表記錄活動
  // 若無此表，可改查 tasks.updated_at 或 profiles.last_active_at
  const { data: activeUsers, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, email")
    .not("email", "is", null)
    .not("email", "eq", "")
    // last_active_at 在本週內
    .gte("last_active_at", weekStart.toISOString())
    .limit(200);

  if (error) throw error;
  if (!activeUsers || activeUsers.length === 0) {
    return { sent: 0, skipped: 0, reason: "No active users this week" };
  }

  // 批次查每個用戶的本週 EXP（從 task_history 累計）
  // 這裡提供 skeleton；若無 task_history 可直接傳 weekExp=0
  const results = await Promise.allSettled(
    activeUsers.map(async (user) => {
      // TODO: 串接 task_history 表，計算 user.id 的本週 EXP
      // const weekExp = await getWeekExp(user.id, weekStart, weekEnd);
      const weekExp = 0; // 暫時填 0，完成 task_history schema 後替換
      const completedCount = 0; // 同上
      const usedAiCrusher = false; // 同上

      const { html, text } = await renderWeeklyReportEmail({
        userName: user.display_name || "辛苦了，獵人！",
        weekExp,
        completedTaskCount: completedCount,
        usedAiCrusher,
      });

      await resend!.emails.send({
        from: RESEND_FROM_EMAIL,
        to: user.email!,
        subject: "✨ 你的本週討伐戰報來了",
        html,
        text,
      });
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return {
    type: "weekly_report",
    batch_size: activeUsers.length,
    sent,
    failed,
  };
}
