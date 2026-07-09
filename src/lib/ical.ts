/**
 * iCal (.ics) generator for VibeList tasks.
 * Produces an RFC 5545-compliant calendar that Google Calendar / Apple Calendar can import.
 *
 * 關鍵 RFC 5545 規則：
 * 1. 行長 ≤ 75 octets（超過需折行,我們目前行長安全）
 * 2. all-day event: DTEND 必須是「DTSTART + 1 day」(exclusive)
 * 3. CRLF (\r\n) 行尾
 * 4. DTSTAMP/CREATED/COMPLETED 必須是 UTC (帶 'Z')
 * 5. 只有 METHOD 為 CANCEL/REQUEST 時 VEVENT 才需要 ATTENDEE；純發布用 METHOD:PUBLISH + 不帶 ATTENDEE
 */

import { Task } from "./types";
import { format, parseISO, addDays } from "date-fns";

function escapeICalText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function foldLine(line: string): string {
  // RFC 5545: lines >75 octets must be folded (split + CRLF + space)
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const end = i === 0 ? Math.min(75, line.length) : Math.min(i + 74, line.length);
    parts.push(line.slice(i, end));
    i = end;
  }
  return parts.join("\r\n ");
}

function formatUTC(d: Date): string {
  return format(d, "yyyyMMdd'T'HHmmss'Z'");
}

function formatLocalDate(d: Date): string {
  return format(d, "yyyyMMdd");
}

function formatLocalDateTime(d: Date): string {
  return format(d, "yyyyMMdd'T'HHmmss");
}

function taskToVEVENT(task: Task): string {
  const lines: string[] = [];

  const uid = `${task.id}@vibelist`;
  lines.push(`UID:${uid}`);

  const created = parseISO(task.createdAt);
  lines.push(`DTSTAMP:${formatUTC(created)}`);
  lines.push(`CREATED:${formatUTC(created)}`);
  lines.push(`LAST-MODIFIED:${formatUTC(created)}`);

  if (task.dueDate) {
    const due = parseISO(task.dueDate);
    if (task.dueTime) {
      // Timed event — use floating local time (no TZ suffix)
      const dueDatetime = new Date(`${task.dueDate}T${task.dueTime}`);
      const startStr = formatLocalDateTime(dueDatetime);
      const endDatetime = new Date(dueDatetime.getTime() + 3600000);
      const endStr = formatLocalDateTime(endDatetime);
      lines.push(`DTSTART:${startStr}`);
      lines.push(`DTEND:${endStr}`);
    } else {
      // All-day event — VALUE=DATE; DTEND must be (due + 1 day) per RFC 5545 §3.6.1
      const dateStr = formatLocalDate(due);
      const endStr = formatLocalDate(addDays(due, 1));
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
      lines.push(`DTEND;VALUE=DATE:${endStr}`);
    }
  }

  lines.push(`SUMMARY:${escapeICalText(task.title)}`);

  if (task.description) {
    lines.push(`DESCRIPTION:${escapeICalText(task.description)}`);
  }

  const priorityMap = { high: "1", medium: "5", low: "9" } as const;
  if (task.priority && task.priority !== "medium") {
    lines.push(`PRIORITY:${priorityMap[task.priority]}`);
  }

  if (task.status === "done") {
    lines.push("STATUS:COMPLETED");
    lines.push(`COMPLETED:${formatUTC(new Date())}`);
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

  return lines.map(foldLine).join("\r\n");
}

export function generateICal(tasks: Task[], listName = "VibeList"): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VibeList//VibeList Task Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(listName)}`,
  ].join("\r\n");

  const events = tasks
    .filter((t) => !t.isArchived && t.dueDate)
    .map((task) => `BEGIN:VEVENT\r\n${taskToVEVENT(task)}\r\nEND:VEVENT`)
    .join("\r\n");

  return `${header}\r\n${events}\r\nEND:VCALENDAR`;
}

export function downloadICal(tasks: Task[], listName = "VibeList"): void {
  const content = generateICal(tasks, listName);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${listName.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
