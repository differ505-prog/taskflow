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
 *   "email": "...",
 *   "taskTitle"?: "...",
 *   "userCount"?: number
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { notifyNewUser, notifyFirstTaskDone } from "@/lib/discordNotifier";

// Rate limiting: simple in-memory (per-instance)
// Production: use Redis or Supabase edge function
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // 20 requests
const RATE_WINDOW_MS = 60_000; // per minute

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

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body = await req.json();
    const { type, email, taskTitle, userCount } = body;

    if (!type || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    switch (type) {
      case "new_user": {
        const provider = body.provider as string | undefined;
        await notifyNewUser(email, provider);
        return NextResponse.json({ success: true });
      }

      case "first_task_done": {
        if (!taskTitle) {
          return NextResponse.json({ error: "taskTitle required" }, { status: 400 });
        }
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
