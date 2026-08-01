/**
 * 推播發送 API（fan-out HTTP endpoint）
 *
 * 用途：撈指定 user 的所有 is_active 訂閱，用 web-push library 推 Web Push。
 *
 * 安全：此 API 只接受兩種呼叫來源：
 *   1. 內部 fan-out worker（帶 CRON_SECRET 或 INTERNAL_PUSH_SECRET）
 *   2. 登入的使用者測試（從前端按鈕呼叫，subject === 自己的 uid）
 *
 * Body: { owner_uid, title, body, url?, task_id? }
 * Response: { sent: number, failed: number, expired: number }
 *
 * 實作：呼叫 src/lib/push/sendPush.ts 共用函式，認證 + 授權在此層。
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push/sendPush";

function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase browser client not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface SendBody {
  owner_uid: string;
  title: string;
  body: string;
  url?: string;
  task_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. 認證：兩種來源皆可 ──
    const internalSecret = request.headers.get("x-internal-push-secret");
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedInternal = process.env.INTERNAL_PUSH_SECRET || process.env.CRON_SECRET;

    let callerUid: string | null = null;
    if (internalSecret && expectedInternal && internalSecret === expectedInternal) {
      // 內部呼叫：owner_uid 從 body 拿
      callerUid = null;
    } else if (cronSecret && expectedInternal && cronSecret === expectedInternal) {
      callerUid = null;
    } else {
      // 使用者自測：需登入
      const browser = getBrowserSupabase();
      const { data: sessionData } = await browser.auth.getSession();
      callerUid = sessionData.session?.user?.id ?? null;
      if (!callerUid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // ── 2. 解析 body ──
    const body = (await request.json()) as SendBody;
    if (!body.owner_uid || !body.title || !body.body) {
      return NextResponse.json(
        { error: "Missing owner_uid / title / body" },
        { status: 400 }
      );
    }

    // 使用者自測時，不能送給別人
    if (callerUid && callerUid !== body.owner_uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 3. 呼叫共用 sendPush ──
    const result = await sendPush({
      owner_uid: body.owner_uid,
      title: body.title,
      body: body.body,
      url: body.url,
      task_id: body.task_id,
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[push/send] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
