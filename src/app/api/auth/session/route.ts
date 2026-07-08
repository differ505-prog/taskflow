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
  // ✅ 診斷增強：把所有初始化階段錯誤都精準暴露
  const diag = {
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    privateKeyLen: process.env.FIREBASE_PRIVATE_KEY?.length ?? 0,
    privateKeyHead: process.env.FIREBASE_PRIVATE_KEY?.slice(0, 30) ?? "",
    privateKeyTail: process.env.FIREBASE_PRIVATE_KEY?.slice(-30) ?? "",
    hasNewlines: process.env.FIREBASE_PRIVATE_KEY?.includes("\n") ?? false,
    hasEscapedNewlines: process.env.FIREBASE_PRIVATE_KEY?.includes("\\n") ?? false,
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const idToken = body?.idToken;
    if (typeof idToken !== "string" || !idToken) {
      return NextResponse.json({ error: "Missing idToken", diag }, { status: 400 });
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
    console.error("[api/auth/session] POST failed:", err?.message || err, err?.stack);
    return NextResponse.json(
      {
        error: "Failed to create session",
        detail: String(err?.message || err),
        code: err?.code,
        diag,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/session
 * 純診斷：回傳環境變數健康狀態（不洩漏完整金鑰內容）
 */
export async function GET(): Promise<NextResponse> {
  const pk = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";

  let adminInitOk = false;
  let adminInitError: string | null = null;
  try {
    getFirebaseAdminAuth();
    adminInitOk = true;
  } catch (e: any) {
    adminInitError = String(e?.message || e);
  }

  return NextResponse.json({
    env: {
      FIREBASE_PROJECT_ID: projectId ? "✅ set" : "❌ missing",
      FIREBASE_CLIENT_EMAIL: clientEmail ? "✅ set" : "❌ missing",
      FIREBASE_PRIVATE_KEY: pk ? `✅ set (${pk.length} chars)` : "❌ missing",
      privateKey_has_real_newlines: pk.includes("\n"),
      privateKey_has_literal_backslash_n: pk.includes("\\n"),
      privateKey_starts_with_pem_header: pk.startsWith("-----BEGIN"),
      privateKey_ends_with_pem_footer: pk.endsWith("-----END PRIVATE KEY-----"),
    },
    adminInit: {
      ok: adminInitOk,
      error: adminInitError,
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV,
    },
  });
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