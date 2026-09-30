/**
 * /api/discord/notify — Discord Webhook 通知 API（Server-side 代理）
 *
 * 用途：前端頁面（AuthContext / AppContext）透過此 API 發送 Discord 通知
 *       避免在前端暴露 DISCORD_WEBHOOK_URL
 *
 * 請求格式：
 * POST /api/discord/notify
 * {
 *   "type": "new_user" | "first_task_done",
 *   "taskTitle"?: "...",
 *   "userCount"?: number
 * }
 *
 * 硬化（§8）：
 *   - email 從 Supabase auth session 讀取，不再信任 client body
 *   - Rate limit: 20/分/IP
 *   - Zod schema：嚴格限制所有欄位長度，防止 DoS
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { notifyNewUser, notifyFirstTaskDone } from "@/lib/discordNotifier";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

// ─── Zod Input Schema ───────────────────────────────────────────────────────
const DiscordNotifyInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("new_user"),
    provider: z.string().max(50).optional(),
  }),
  z.object({
    type: z.literal("first_task_done"),
    taskTitle: z.string().min(1).max(200),
    userCount: z.number().int().min(0).max(1_000_000).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    // Rate limiting (distributed via Supabase)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const { allowed } = await checkRateLimit(`discord:notify:ip:${ip}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    // ─── 解析並驗證 body（Zod schema）───────────────────────────
    const body = await req.json();
    const parsed = DiscordNotifyInput.safeParse(body);
    if (!parsed.success) {
      console.warn("[discord/notify] Invalid body:", parsed.error.issues);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { type } = parsed.data;

    // ─── 從 Supabase session 取得真實 email ───
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let serverEmail: string | null = null;
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
        },
      });
      const { data: { user } } = await supabase.auth.getUser();
      serverEmail = user?.email ?? null;
    }

    switch (type) {
      case "new_user": {
        if (!serverEmail) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await notifyNewUser(serverEmail, parsed.data.provider);
        return NextResponse.json({ success: true });
      }

      case "first_task_done": {
        if (!serverEmail) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { taskTitle, userCount } = parsed.data;
        await notifyFirstTaskDone(serverEmail, taskTitle, userCount ?? 0);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }
  } catch (err) {
    console.error("[api/discord/notify] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
