/**
 * 測試推播 API（user self-test）
 *
 * 用途：使用者按 SettingsPage 的「測試推播」按鈕時呼叫。
 * 不需使用者貼 user_id — 從 cookie/JWT 自動解析自己。
 *
 * 底層呼叫 /api/push/send，套用既有「登入者只能送給自己」的安全檢查（line 95-97）。
 *
 * Response: { sent: number, failed: number, expired: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(_request: NextRequest) {
  try {
    const browser = getBrowserSupabase();
    const { data: sessionData } = await browser.auth.getSession();
    const callerUid = sessionData.session?.user?.id ?? null;

    if (!callerUid) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    // 內部 call /api/push/send — 用 NEXT_PUBLIC 內部絕對 URL
    // 但同網域直接用 request.url 推導 base 即可，避免硬寫 domain
    const base = new URL(_request.url).origin;
    const res = await fetch(`${base}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner_uid: callerUid,
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
