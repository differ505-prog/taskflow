/**
 * 推播發送 API（fan-out）
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
 * 依賴：npm install web-push（待補 package.json）
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client not configured");
  }
  return createClient(url, key);
}

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

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@vibelist.app";
  if (!pub || !priv) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
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
      callerUid = null; // 不驗 session
    } else if (cronSecret && expectedInternal && cronSecret === expectedInternal) {
      callerUid = null;
    } else {
      // 使用者自測：需登入，且只能對自己送
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

    // ── 3. 撈該 user 的所有 active 訂閱 ──
    const admin = getSupabaseAdmin();
    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("owner_uid", body.owner_uid)
      .eq("is_active", true);

    if (subsErr) {
      console.error("[push/send] select subs error:", subsErr);
      return NextResponse.json({ error: subsErr.message }, { status: 500 });
    }
    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, expired: 0 });
    }

    // ── 4. fan-out ──
    ensureVapid();
    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url,
      tag: body.task_id ? `task-${body.task_id}` : "taskflow-notification",
    });

    let sent = 0;
    let failed = 0;
    let expired = 0;

    await Promise.all(
      subs.map(async (sub) => {
        const logId = `nl_${crypto.randomUUID()}`;
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
          await admin.from("notification_log").insert({
            id: logId,
            owner_uid: body.owner_uid,
            subscription_id: sub.id,
            task_id: body.task_id ?? null,
            title: body.title,
            body: body.body,
            url: body.url ?? null,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
          // 更新 last_seen_at
          await admin
            .from("push_subscriptions")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", sub.id);
        } catch (e: unknown) {
          const err = e as { statusCode?: number; message?: string };
          const isGone = err.statusCode === 404 || err.statusCode === 410;
          if (isGone) {
            expired++;
            // 標記訂閱失效
            await admin
              .from("push_subscriptions")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("id", sub.id);
            await admin.from("notification_log").insert({
              id: logId,
              owner_uid: body.owner_uid,
              subscription_id: sub.id,
              task_id: body.task_id ?? null,
              title: body.title,
              body: body.body,
              url: body.url ?? null,
              status: "expired",
              error_message: err.message ?? "subscription expired",
            });
          } else {
            failed++;
            await admin.from("notification_log").insert({
              id: logId,
              owner_uid: body.owner_uid,
              subscription_id: sub.id,
              task_id: body.task_id ?? null,
              title: body.title,
              body: body.body,
              url: body.url ?? null,
              status: "failed",
              error_message: err.message ?? "unknown",
            });
          }
        }
      })
    );

    return NextResponse.json({ sent, failed, expired });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[push/send] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
