/**
 * 測試推播 API（user self-test）
 *
 * 用途：使用者按 SettingsPage 的「測試推播」按鈕時呼叫。
 * 不需使用者貼 user_id — 從 cookie 自動解析自己。
 *
 * 底層呼叫 /api/push/send，套用既有「登入者只能送給自己」的安全檢查（line 95-97）。
 *
 * Response: { sent: number, failed: number, expired: number }
 *
 * 注意：必須用 createServerClient + req.cookies.getAll()，
 *       不能用 createClient + getSession()（server-side 沒有 localStorage）。
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    // 內部 call /api/push/send — 用 request URL 推導 base，避免硬寫 domain
    const base = new URL(request.url).origin;
    const res = await fetch(`${base}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner_uid: user.id,
        title: "TaskFlow 推播成功",
        body: "你收到這則就代表全鏈通了 🎉",
        url: "/",
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[push/test-self] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
