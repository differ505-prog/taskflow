/**
 * 推播訂閱註冊 API
 *
 * 用途：前端 pushManager.subscribe() 成功後呼叫，把 PushSubscription
 *       存到 Supabase 的 push_subscriptions 表。
 *
 * 安全：用 Supabase service role key 寫入（繞過 RLS），
 *       但需驗證前端帶的 user uid（從 auth session 推導），
 *       防止別人偽造訂閱資料寫到別人帳號。
 *
 * Body: { endpoint, keys: { p256dh, auth }, userAgent, deviceLabel }
 * Response: { id, owner_uid, endpoint, created_at }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client not configured");
  }
  return createClient(url, key);
}

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  deviceLabel?: string;
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. 驗證登入身份（從 cookie 讀 session） ──
    // §23: 用 createServerClient + getUser，跟 test-self 一致；
    //      不要用 getSession()（server-side 拿不到 localStorage → null → 401）
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. 解析 body ──
    const body = (await request.json()) as SubscribeBody;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: "Missing endpoint / keys.p256dh / keys.auth" },
        { status: 400 }
      );
    }

    // ── 3. upsert（同一個 endpoint 重訂就更新） ──
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("push_subscriptions")
      .upsert(
        {
          owner_uid: user.id,
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          user_agent: body.userAgent || request.headers.get("user-agent") || null,
          device_label: body.deviceLabel || null,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "endpoint",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error("[push/subscribe] upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[push/subscribe] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
