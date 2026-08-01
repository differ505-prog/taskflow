/**
 * 推播取消訂閱 API
 *
 * Body: { endpoint }
 * Response: { ok: true }
 *
 * 邏輯：把該 endpoint 設為 is_active = false（軟刪除），
 *       保留 record 讓 notification_log 外鍵仍有效。
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

export async function POST(request: NextRequest) {
  try {
    // §23: 用 createServerClient + getUser，不要用 getSession()
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

    const body = (await request.json()) as { endpoint: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("push_subscriptions")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("endpoint", body.endpoint)
      .eq("owner_uid", user.id);

    if (error) {
      console.error("[push/unsubscribe] update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[push/unsubscribe] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
