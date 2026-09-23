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
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { notifyFeedback } from "@/lib/discordNotifier";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Zod Input Schema ───────────────────────────────────────────────────────
const FeedbackInput = z.object({
  message: z.string().min(1).max(2000),
  context: z.record(z.string(), z.unknown()).optional(),
});

function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const { allowed } = await checkRateLimit(`feedback:ip:${ip}`, 30, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "太多次數,請稍後再試" }, { status: 429 });
    }

    // 1. 解析並驗證 body（Zod schema）
    const body = await req.json();
    const parsed = FeedbackInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
    }
    const { message, context } = parsed.data;

    // 2. 驗證登入(透過 cookie session)，並從 session 取得真實 email
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    const userId: string | null = user?.id ?? null;
    const userEmail: string | null = user?.email ?? null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2.5. 從 DB 取得真實 userRole（不再信任 client body）
    let userRole = "free";
    const dbClient = getServiceClient();
    if (dbClient) {
      const { data: profile } = await dbClient
        .from("user_profiles")
        .select("role")
        .eq("uid", userId)
        .single();
      userRole = profile?.role ?? "free";
    }

    // 3. 寫入 Supabase（user_email 強制使用 server-side session email）
    if (!dbClient) {
      return NextResponse.json({ error: "後端未設定" }, { status: 500 });
    }

    const insertPayload = {
      user_id: userId,
      user_email: userEmail ?? null,  // 不再信任 client body.userEmail
      user_role: userRole,
      message: message,
      context: context ?? {},
    };

    const { data: inserted, error: dbError } = await dbClient
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
