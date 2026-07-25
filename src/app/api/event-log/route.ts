/**
 * /api/event-log — 前端事件追蹤接收器 (Fake Door Test 專用)
 *
 * 用途：
 *   接收幽靈按鈕點擊事件,計算「假門測試轉換率」
 *
 * Request：
 *   POST /api/event-log
 *   {
 *     "event": "click_ghost_button_timebar",        // 事件名 (snake_case)
 *     "buttonId": "timebar" | "unlimited_shred",    // 哪個按鈕
 *     "metadata": { ... }                            // 選填附帶資訊
 *   }
 *
 * Response：
 *   { "success": true }
 *
 * 設計重點：
 * 1. MVP 階段:僅 console.log + Supabase event log table (若 env 沒設,console-only fallback)
 * 2. 不依賴登入:匿名事件也能追蹤(幽靈按鈕本質是「意向收集」,匿名點擊也算點擊)
 * 3. 不寫死 storage:若將來要接 PostHog / Amplitude,只動這個檔
 * 4. 錯誤一律 200(事件追蹤失敗不該影響主流程 UX)
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface EventPayload {
  event: string;
  buttonId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EventPayload;

    if (!body.event || typeof body.event !== "string") {
      // 事件追蹤的錯誤不應外洩給前端(可能影響 UX)
      // 但仍記 server log 供除錯
      console.warn("[event-log] Invalid event payload:", body);
      return NextResponse.json({ success: false }, { status: 200 });
    }

    // SSR-safe timestamp
    const timestamp = new Date().toISOString();
    const enriched = {
      ...body,
      timestamp,
      // 從 header 拿 IP(無個資,只用作去重 key)
      ip:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown",
    };

    // MVP:console-only;若未來接 PostHog/Amplitude/Supabase table,在這裡加
    // 不要 throw,失敗也不影響前端
    try {
      console.log("[event-log]", JSON.stringify(enriched));
    } catch (logErr) {
      console.error("[event-log] Failed to log event:", logErr);
    }

    return NextResponse.json({ success: true });
  } catch {
    // 事件追蹤最嚴格要求:任何錯誤都不該外洩或影響主流程
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
