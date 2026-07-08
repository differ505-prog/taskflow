/**
 * POST /api/auth/session
 *   Body: { accessToken: string, refreshToken: string }
 *   功能：設定 Supabase Auth Session via HttpOnly cookies
 *
 * DELETE /api/auth/session
 *   功能：清除 Auth Session
 *
 * 為何用 HttpOnly cookies：
 *   - JS 讀不到 session token，防止 XSS 盜取
 *   - Supabase client 會自動處理 refresh token 刷新
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

// 🔑 Supabase SSR client 需要 Node.js runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const diag = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const { accessToken, refreshToken } = body ?? {};

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: "Missing accessToken or refreshToken", diag },
        { status: 400 }
      );
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "Session creation failed", diag },
        { status: 500 }
      );
    }

    const isProd = process.env.NODE_ENV === "production";
    const res = NextResponse.json({ ok: true, userId: data.user.id });
    res.cookies.set({
      name: "__sb_session",
      value: "active",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (err: any) {
    console.error("[api/auth/session] POST failed:", err?.message || err, err?.stack);
    return NextResponse.json(
      { error: "Failed to create session", detail: String(err?.message || err), diag },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/session
 * 診斷：環境變數健康狀態（不洩漏 key 內容）
 */
export async function GET(): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return NextResponse.json({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? "✅ set" : "❌ missing",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey
        ? `✅ set (${anonKey.length} chars)`
        : "❌ missing",
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV,
    },
  });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
        },
      },
    }
  );
  await supabase.auth.signOut();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "__sb_session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
