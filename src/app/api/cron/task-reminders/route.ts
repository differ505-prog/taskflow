/**
 * Vercel Cron — 任務到期提醒掃描
 *
 * 觸發：每分鐘（vercel.json cron 設定）
 *
 * 流程：
 *   1. 撈所有 fan_out_queue 中 processed_at is null 且 scheduled_for <= now 的列
 *   2. 對每列呼叫 /api/push/send 內部 fan-out
 *   3. 標記 processed_at
 *
 * 安全：CRON_SECRET header 由 Vercel 自動注入
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client not configured");
  }
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  // ── 1. 安全認證 ──
  // Vercel Cron 自動注入 Authorization Bearer header;
  // query string ?secret= 與 x-cron-secret header 留作 manual trigger 備援
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = req.nextUrl.searchParams.get("secret");
  const headerSecret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!expected) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }
    // Vercel Cron 自動送 Authorization Bearer；x-cron-secret / ?secret= 留作手動測試
    if (
      bearerToken !== expected &&
      querySecret !== expected &&
      headerSecret !== expected
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = getSupabaseAdmin();

    // ── 2. 撈待處理 queue 列 ──
    const { data: pending, error } = await admin
      .from("fan_out_queue")
      .select("id, owner_uid, task_id, trigger_type, payload")
      .is("processed_at", null)
      .lte("scheduled_for", new Date().toISOString())
      .limit(100);

    if (error) {
      console.error("[cron/task-reminders] select error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // ── 3. 對每列觸發內部 fan-out ──
    const internalSecret = process.env.INTERNAL_PUSH_SECRET || process.env.CRON_SECRET || "";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    let processed = 0;
    for (const row of pending) {
      try {
        const payload = row.payload as {
          title?: string;
          body?: string;
          url?: string;
        };
        const body = payload.body || `任務提醒：${row.task_id}`;
        const title = payload.title || "TaskFlow";

        // 內部呼叫 /api/push/send
        if (appUrl) {
          await fetch(`${appUrl}/api/push/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-push-secret": internalSecret,
            },
            body: JSON.stringify({
              owner_uid: row.owner_uid,
              task_id: row.task_id,
              title,
              body,
              url: payload.url,
            }),
          });
        }

        // 標記已處理
        await admin
          .from("fan_out_queue")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", row.id);
        processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[cron/task-reminders] failed to process ${row.id}:`, msg);
      }
    }

    return NextResponse.json({ processed, total: pending.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/task-reminders] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
