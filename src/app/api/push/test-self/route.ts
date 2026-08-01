/**
 * 測試推播 API（user self-test）
 *
 * 用途：使用者按 SettingsPage 的「測試推播」按鈕時呼叫。
 * 不需使用者貼 user_id — 從 cookie 自動解析自己。
 *
 * 直接呼叫共用 sendPush 函式（src/lib/push/sendPush.ts），不繞道 /api/push/send —
 * 避免 server-side fetch 帶 cookie 的複雜性。
 *
 * Response: { sent: number, failed: number, expired: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendPush } from "@/lib/push/sendPush";

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

    const result = await sendPush({
      owner_uid: user.id,
      title: "TaskFlow 推播成功",
      body: "你收到這則就代表全鏈通了 🎉",
      url: "/",
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[push/test-self] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
