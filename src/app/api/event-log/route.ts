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
 *     "metadata": { ... }                            // 選填附帶資訊（上限 5KB）
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
 * 5. Rate limit: 60次/分/IP，防止濫發
 * 6. Event 白名單：不在白名單內的事件靜默丟棄
 * 7. Zod schema：metadata 上限 5KB，防止 DB / log injection DoS
 */
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ─── Zod Input Schema ───────────────────────────────────────────────────────
const EventLogInput = z
  .object({
    event: z.string().min(1).max(100),
    buttonId: z.string().max(100).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => JSON.stringify(data.metadata ?? {}).length < 5000,
    { message: "metadata exceeds 5KB limit" }
  );

// ─── Event 白名單 ───
const ALLOWED_EVENTS = new Set([
  "click_ghost_button_timebar",
  "click_ghost_button_unlimited_shred",
  "click_ghost_button_ai_summary",
  "click_ghost_button_karma_mode",
  "click_ghost_button_domino_tasks",
  "feedback_submitted",
  "upgrade_modal_viewed",
  "painted_door_clicked",
]);

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { allowed } = await checkRateLimit(`event-log:ip:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ success: false }, { status: 200 });
    }

    // ── 解析並驗證 body（Zod schema）───────────────────────────
    let parsed: z.infer<typeof EventLogInput>;
    try {
      const raw = await req.json();
      const result = EventLogInput.safeParse(raw);
      if (!result.success) {
        // 格式錯誤 → 靜默回 200（設計如此，不外洩細節）
        return NextResponse.json({ success: false }, { status: 200 });
      }
      parsed = result.data;
    } catch {
      return NextResponse.json({ success: false }, { status: 200 });
    }

    // 白名單檢查（parsed.event 已由 Zod 推斷為 non-null string）
    if (!ALLOWED_EVENTS.has(parsed.event)) {
      return NextResponse.json({ success: false }, { status: 200 });
    }

    // SSR-safe timestamp
    const timestamp = new Date().toISOString();
    const enriched = {
      event: parsed.event,
      buttonId: parsed.buttonId ?? undefined,
      metadata: parsed.metadata ?? {},
      timestamp,
      ip,
    };

    try {
      console.log("[event-log]", JSON.stringify(enriched));
    } catch (logErr) {
      console.error("[event-log] Failed to log event:", logErr);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
