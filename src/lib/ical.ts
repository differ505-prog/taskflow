/**
 * iCal (.ics) generator for VibeList tasks.
 * Produces an RFC 5545-compliant calendar that Google Calendar / Apple Calendar can import.
 */

import { Task } from "./types";
import { format, parseISO } from "date-fns";

function escapeICalText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
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

  if (task.dueDate) {
    const due = parseISO(task.dueDate);
    if (task.dueTime) {
      // Timed event — use LOCAL (floating) time format (no TZ suffix)
      // Google Calendar & Apple Calendar both treat this as floating time
      const dueDatetime = new Date(`${task.dueDate}T${task.dueTime}`);
      const startStr = formatLocalDateTime(dueDatetime);
      // Default end = start + 1 hour
      const endDatetime = new Date(dueDatetime.getTime() + 3600000);
      const endStr = formatLocalDateTime(endDatetime);
      lines.push(`DTSTART:${startStr}`);
      lines.push(`DTEND:${endStr}`);
    } else {
      // All-day event — VALUE=DATE (RFC 5545 compliant)
      const dateStr = formatLocalDate(due);
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
      lines.push(`DTEND;VALUE=DATE:${dateStr}`);
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

export function generateICal(tasks: Task[], listName = "VibeList"): string {
  const now = new Date();
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VibeList//VibeList Task Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(listName)}`,
  ].join("\r\n");

  const events = tasks
    .filter((t) => !t.isArchived && (t.dueDate || t.status !== "done"))
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
