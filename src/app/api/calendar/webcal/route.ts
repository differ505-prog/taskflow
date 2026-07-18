import { NextRequest, NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { createServerClient } from "@supabase/ssr";
import type { Task } from "@/lib/types";

function escapeICalText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/**
 * RFC 5545 §3.1: Lines longer than 75 octets must be folded.
 * We fold by replacing the 74th character with CRLF + single space.
 */
function foldLine(line: string): string {
  const MAX = 74;
  if (line.length <= MAX) return line;
  const chunks: string[] = [];
  let remaining = line;
  // First chunk can be up to 74 chars; subsequent chunks start with space
  while (remaining.length > MAX) {
    chunks.push(remaining.slice(0, MAX));
    remaining = " " + remaining.slice(MAX);
  }
  chunks.push(remaining);
  return chunks.join("\r\n");
}

function formatDate(d: Date): string {
  return format(d, "yyyyMMdd'T'HHmmss'Z'");
}

function taskToVEVENT(task: Task): string[] {
  const lines: string[] = [];
  lines.push(foldLine(`UID:${task.id}@vibelist`));
  const created = parseISO(task.createdAt);
  lines.push(`DTSTAMP:${formatDate(created)}`);
  lines.push(`CREATED:${formatDate(created)}`);

  if (task.dueDate) {
    const due = parseISO(task.dueDate);
    if (task.dueTime) {
      // 有時間 → 時段事件
      const startDt = `${format(due, "yyyyMMdd'T'")}${task.dueTime.replace(":", "")}00`;
      const endDt = `${format(due, "yyyyMMdd'T'")}${task.dueTime.replace(":", "")}00`;
      lines.push(`DTSTART:${startDt}`);
      lines.push(`DTEND:${endDt}`);
    } else {
      // 無時間 → 全日事件
      lines.push(`DTSTART;VALUE=DATE:${format(due, "yyyyMMdd")}`);
      lines.push(`DTEND;VALUE=DATE:${format(due, "yyyyMMdd")}`);
    }
  }

  lines.push(`SUMMARY:${escapeICalText(task.title)}`);

  if (task.description) {
    lines.push(`DESCRIPTION:${escapeICalText(task.description)}`);
  }

  // RFC 5545 PRIORITY: 1=highest, 9=lowest
  const priorityMap = { "do-now": "1", schedule: "3", delegate: "5", none: "9" } as const;
  if (task.priority && task.priority !== "delegate") {
    lines.push(`PRIORITY:${priorityMap[task.priority]}`);
  }

  if (task.status === "done") {
    lines.push("STATUS:COMPLETED");
    lines.push(`COMPLETED:${formatDate(new Date())}`);
  } else {
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");
  }

  if (task.tags.length > 0) {
    lines.push(`CATEGORIES:${task.tags.map(escapeICalText).join(",")}`);
  }

  lines.push(`X-VIBELIST-ID:${task.id}`);
  if (task.listId) {
    lines.push(`X-VIBELIST-LIST-ID:${task.listId}`);
  }

  return lines;
}

/**
 * Webcal Feed API
 *
 * GET /api/calendar/webcal
 *
 * 授權方式：Supabase Auth Cookie（自動由 @supabase/ssr 處理）
 * 回傳格式：text/calendar（.ics）
 *
 * 與舊 /api/calendar/feed 的差異：
 * - 改用 POST（避免 URL 長度限制）+ 直接從 Supabase 讀取任務
 * - RFC 5545 行折疊（foldLine）完整實作
 * - 有時間的任務輸出 DTSTART/DTEND（非 UTC，全日事件才用 VALUE=DATE）
 * - STATUS：已完成 → COMPLETED，未完成 → CONFIRMED + TRANSP:OPAQUE
 */
export async function GET(request: NextRequest) {
  // 建立 Supabase 客戶端（自動處理 Auth Cookie）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // API route 不可設定 cookie，只讀取
        },
      },
    }
  );

  // 驗證登入
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 從 Supabase 讀取該用戶的個人任務
  const { data: tasks, error: tasksError } = await supabase
    .from("personal_tasks")
    .select("*")
    .eq("uid", user.id);

  if (tasksError) {
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }

  const now = new Date();
  const filteredTasks = (tasks as Task[] ?? []).filter(
    (t) => !t.isArchived && (t.dueDate || t.status !== "done")
  );

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VibeList//Task Manager//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:VibeList",
    `X-VIBELIST-EXPORT:${format(now, "yyyy-MM-dd'T'HH:mm:ss'Z'")}`,
    `X-PUBLISHED-TTL:PT1H`,
    "METHOD:PUBLISH",
  ].join("\r\n");

  const events = filteredTasks
    .map((task) => {
      const veventLines = taskToVEVENT(task);
      return [
        "BEGIN:VEVENT",
        ...veventLines,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const ics = `${header}\r\n${events}\r\nEND:VCALENDAR`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=\"vibelist.ics\"",
      "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
    },
  });
}
