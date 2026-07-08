/**
 * POST /api/auth/session
 *   Body: { idToken: string }
 *   功能：用短期 ID token 換取 14 天的 HttpOnly Session Cookie
 *
 * DELETE /api/auth/session
 *   功能：清除 Session Cookie
 *
 * 為何要用 session cookie：
 *   - 前端 ID token 存在記憶體或 sessionStorage，XSS 有機會偷到
 *   - HttpOnly cookie JS 讀不到，CSRF 用 SameSite=Lax 阻擋
 *   - 14 天效期內免重新登入
 */
import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";

const COOKIE_NAME = "__session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 天

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const idToken = body?.idToken;
    if (typeof idToken !== "string" || !idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const auth = getFirebaseAdminAuth();
    // expiresIn 必須是 number seconds（最多 2 週）
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_TTL_SECONDS * 1000,
    });

    const isProd = process.env.NODE_ENV === "production";
    const res = NextResponse.json({ ok: true, expiresIn: SESSION_TTL_SECONDS });
    res.cookies.set({
      name: COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (err: any) {
    console.error("[api/auth/session] POST failed:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to create session", detail: String(err?.message || err) },
      { status: 401 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}