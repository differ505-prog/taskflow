import { NextRequest, NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import type { Task } from "@/lib/types";

// ─── Rate limit (IP-based, in-memory) ───
const feedBuckets = new Map<string, { count: number; resetAt: number }>();
const FEED_LIMIT = 30;
const FEED_WINDOW_MS = 60_000;

function checkFeedRateLimit(ip: string): boolean {
  const now = Date.now();
  const b = feedBuckets.get(ip);
  if (!b || b.resetAt < now) {
    feedBuckets.set(ip, { count: 1, resetAt: now + FEED_WINDOW_MS });
    return true;
  }
  if (b.count >= FEED_LIMIT) return false;
  b.count += 1;
  return true;
}

function escapeICalText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function formatDate(d: Date): string {
  return format(d, "yyyyMMdd'T'HHmmss'Z'");
}

function taskToVEVENT(task: Task): string {
  const lines: string[] = [];
  lines.push(`UID:${task.id}@vibelist`);
  const created = parseISO(task.createdAt);
  lines.push(`DTSTAMP:${formatDate(created)}`);
  lines.push(`CREATED:${formatDate(created)}`);

  if (task.dueDate) {
    const due = parseISO(task.dueDate);
    lines.push(`DTSTART;VALUE=DATE:${format(due, "yyyyMMdd")}`);
    lines.push(`DTEND;VALUE=DATE:${format(due, "yyyyMMdd")}`);
  }

  lines.push(`SUMMARY:${escapeICalText(task.title)}`);

  if (task.description) {
    lines.push(`DESCRIPTION:${escapeICalText(task.description)}`);
  }

  // RFC 5545 PRIORITY: 1=highest, 9=lowest, 5=normal
  const priorityMap = { "do-now": "1", schedule: "3", delegate: "5", none: "9" } as const;
  if (task.priority && task.priority !== "delegate") {
    lines.push(`PRIORITY:${priorityMap[task.priority]}`);
  }

  if (task.status === "done") {
    lines.push("STATUS:COMPLETED");
    lines.push(`COMPLETED:${formatDate(new Date())}`);
  } else {
    lines.push("STATUS:IN-PROCESS");
  }

  if (task.tags.length > 0) {
    lines.push(`CATEGORIES:${task.tags.map(escapeICalText).join(",")}`);
  }

  lines.push(`X-VIBELIST-ID:${task.id}`);
  if (task.listId) {
    lines.push(`X-VIBELIST-LIST-ID:${task.listId}`);
  }

  return lines.join("\r\n");
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkFeedRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = request.nextUrl;
  const tasksParam = searchParams.get("tasks");

  // ─── Base64 payload 大小限制（~300KB）───
  const MAX_TASKS_BASE64 = 300_000;
  if (tasksParam && tasksParam.length > MAX_TASKS_BASE64) {
    return NextResponse.json({ error: "資料過大" }, { status: 413 });
  }

  let tasks: Task[] = [];
  if (tasksParam) {
    try {
      const decoded = Buffer.from(tasksParam, "base64").toString("utf-8");
      tasks = JSON.parse(decoded) as Task[];
    } catch {
      tasks = [];
    }
  }

  const now = new Date();
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VibeList//VibeList Task Manager//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:VibeList",
    `X-VIBELIST-EXPORT:${format(now, "yyyy-MM-dd'T'HH:mm:ss'Z'")}`,
    "METHOD:PUBLISH",
  ].join("\r\n");

  const events = tasks
    .filter((t) => !t.isArchived && (t.dueDate || t.status !== "done"))
    .map((task) => `BEGIN:VEVENT\r\n${taskToVEVENT(task)}\r\nEND:VEVENT`)
    .join("\r\n");

  const ics = `${header}\r\n${events}\r\nEND:VCALENDAR`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=\"vibelist.ics\"",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
