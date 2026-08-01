/**
 * 共用推播發送函式（fan-out）
 *
 * 從原本 /api/push/send 抽出 — 任何路徑（API endpoint / cron worker / self-test）
 * 都能呼叫，不需要再走 HTTP fetch。
 *
 * 用法：
 *   const result = await sendPush({
 *     owner_uid: "...",
 *     title: "...",
 *     body: "...",
 *     url?: "...",
 *     task_id?: "...",
 *   });
 *   // { sent: number, failed: number, expired: number }
 *
 * 不做 auth — 呼叫者負責驗證 caller 跟 owner_uid 的關係。
 */
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

export interface SendPushInput {
  owner_uid: string;
  title: string;
  body: string;
  url?: string;
  task_id?: string;
}

export interface SendPushResult {
  sent: number;
  failed: number;
  expired: number;
}

export async function sendPush(input: SendPushInput): Promise<SendPushResult> {
  const admin = getSupabaseAdmin();

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("owner_uid", input.owner_uid)
    .eq("is_active", true);

  if (subsErr) {
    throw new Error(`select subs error: ${subsErr.message}`);
  }
  if (!subs || subs.length === 0) {
    return { sent: 0, failed: 0, expired: 0 };
  }

  ensureVapid();
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.task_id ? `task-${input.task_id}` : "taskflow-notification",
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
          owner_uid: input.owner_uid,
          subscription_id: sub.id,
          task_id: input.task_id ?? null,
          title: input.title,
          body: input.body,
          url: input.url ?? null,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        await admin
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (e: unknown) {
        const err = e as { statusCode?: number; message?: string };
        const isGone = err.statusCode === 404 || err.statusCode === 410;
        if (isGone) {
          expired++;
          await admin
            .from("push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          await admin.from("notification_log").insert({
            id: logId,
            owner_uid: input.owner_uid,
            subscription_id: sub.id,
            task_id: input.task_id ?? null,
            title: input.title,
            body: input.body,
            url: input.url ?? null,
            status: "expired",
            error_message: err.message ?? "subscription expired",
          });
        } else {
          failed++;
          await admin.from("notification_log").insert({
            id: logId,
            owner_uid: input.owner_uid,
            subscription_id: sub.id,
            task_id: input.task_id ?? null,
            title: input.title,
            body: input.body,
            url: input.url ?? null,
            status: "failed",
            error_message: err.message ?? "unknown",
          });
        }
      }
    })
  );

  return { sent, failed, expired };
}
