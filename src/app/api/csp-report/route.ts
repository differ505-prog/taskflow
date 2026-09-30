/**
 * /api/csp-report — Content Security Policy 違規舉報接收端點
 *
 * 用途：
 *   接收瀏覽器 CSP 報告（XSS 嘗試失敗時觸發），
 *   僅作 log，不做任何處理，防止端點本身被濫用。
 *
 * Security：
 *   - 完全只讀，無寫入，無 DB 操作
 *   - 不外洩任何詳細資訊
 *   - Rate limit 已由全域 Supabase rate limiter 覆蓋（60/min/IP）
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    // 只 log，不做任何處理；日誌進 Sentry / CloudWatch
    console.warn("[CSP Violation]", JSON.stringify(body ?? "empty or non-JSON body"));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
