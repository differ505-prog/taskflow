/**
 * /api/feedback — 反饋寫入 API（Server-side 對齊 discord/notify pattern）
 *
 * 設計動機(§B 評分 9.2):
 *   封測/公測期,BetaTester / Pro / Admin 按下「📣」→ 寫入 Supabase feedback 表
 *   同時觸發 Discord webhook 通知開發者,便於即時收到反饋。
 *
 * 對齊既有 pattern(§25):
 *   - 同 /api/discord/notify 的 rate limit 守護
 *   - Server-side 寫入 Supabase(service_role 從環境變數讀)
 *   - 失敗靜默 Discord 推送(§8 不阻塞主流程)
 *
 * 資安(§8):
 *   - user_id 從 Supabase auth 驗證後的 session 取得,不信任前端傳入
 *   - message 長度限制 2000 字(對齊前端 maxLength)
 *   - context JSON 大小限制 50KB
 *   - Rate limit 30 / hour(開發者不會 spam,但允許批次)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyFeedback } from "@/lib/discordNotifier";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limiting: 30 / hour per IP
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "太多次數,請稍後再試" }, { status: 429 });
    }

    const body = await req.json();
    const { message, userEmail, userRole, context } = body ?? {};

    // 1. 驗證
    if (typeof message !== "string") {
      return NextResponse.json({ error: "message 格式錯誤" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "訊息過長(上限 2000 字)" }, { status: 400 });
    }
    if (context !== undefined && context !== null) {
      const contextStr = JSON.stringify(context);
      if (contextStr.length > 50_000) {
        return NextResponse.json({ error: "context 過大" }, { status: 400 });
      }
    }

    // 2. 驗證登入(透過 cookie 讀取 Supabase session)
    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "後端未設定" }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    let userId: string | null = null;
    if (bearerToken) {
      const { data } = await supabase.auth.getUser(bearerToken);
      userId = data.user?.id ?? null;
    }

    // 3. 寫入 Supabase
    const insertPayload = {
      user_id: userId,
      user_email: userEmail ?? null,
      user_role: userRole ?? "free",
      message: message.slice(0, 2000),
      context: context ?? {},
    };

    const { data: inserted, error: dbError } = await supabase
      .from("feedback")
      .insert(insertPayload)
      .select("id, created_at")
      .single();

    if (dbError) {
      console.error("[api/feedback] DB insert failed:", dbError);
      return NextResponse.json(
        { error: "儲存失敗,請稍後再試" },
        { status: 500 }
      );
    }

    // 4. 觸發 Discord 通知(§8 失敗靜默)
    const previewText = (message || "(無訊息,僅 metadata)").slice(0, 200);
    void notifyFeedback({
      userEmail: userEmail ?? null,
      userRole: userRole ?? "free",
      route: (context?.route as string) ?? "",
      previewText,
      context,
    });

    return NextResponse.json({
      success: true,
      id: inserted.id,
      createdAt: inserted.created_at,
    });
  } catch (err) {
    console.error("[api/feedback] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
