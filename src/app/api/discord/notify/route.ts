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
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { notifyNewUser, notifyFirstTaskDone } from "@/lib/discordNotifier";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting (distributed via Supabase)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const { allowed } = await checkRateLimit(`discord:notify:ip:${ip}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

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

    const body = await req.json();
    const { type, taskTitle, userCount } = body;

    if (!type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    switch (type) {
      case "new_user": {
        if (!serverEmail) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const email = serverEmail;
        const provider = body.provider as string | undefined;
        await notifyNewUser(email, provider);
        return NextResponse.json({ success: true });
      }

      case "first_task_done": {
        if (!serverEmail) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!taskTitle) {
          return NextResponse.json({ error: "taskTitle required" }, { status: 400 });
        }
        const email = serverEmail;
        await notifyFirstTaskDone(email, taskTitle, userCount ?? 0);
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
