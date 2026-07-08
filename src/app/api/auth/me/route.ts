/**
 * GET /api/auth/me
 *   從 HttpOnly Session Cookie 解析當前使用者
 *   用於：
 *     1. Server-side rendering 時決定要不要重導到 /login
 *     2. Sanity check：前端可以 call 一次證明 cookie 路徑通
 */
import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";

const COOKIE_NAME = "__session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get(COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return NextResponse.json({
      user: {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerified: decoded.email_verified ?? false,
      },
    });
  } catch (err: any) {
    console.warn("[api/auth/me] verify failed:", err?.message || err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}