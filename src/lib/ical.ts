/**
 * iCal (.ics) generator for VibeList tasks.
 * Produces a RFC 5545-compliant calendar that Google Calendar / Apple Calendar can import.
 */

import { Task } from "./types";
import { format, parseISO } from "date-fns";

const PRODID = "-//VibeList//VibeList Task Manager//EN";

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

function formatDateLocal(d: Date): string {
  return format(d, "yyyyMMdd");
}

function taskToVEVENT(task: Task): string {
  const lines: string[] = [];

  const uid = `${task.id}@vibelist`;
  lines.push(`UID:${uid}`);

  const created = parseISO(task.createdAt);
  lines.push(`DTSTAMP:${formatDate(created)}`);
  lines.push(`CREATED:${formatDate(created)}`);

  if (task.dueDate) {
    const due = parseISO(task.dueDate);
    const dateStr = task.dueTime
      ? `${formatDate(due)}/${formatDate(new Date(`${task.dueDate}T${task.dueTime}`))}`
      : formatDateLocal(due);
    lines.push(`DTSTART${task.dueTime ? "" : ";VALUE=DATE"}:${task.dueTime ? dateStr.split("/")[0] : dateStr}`);
    if (task.dueTime) {
      lines.push(`DTEND:${dateStr.split("/")[1] || dateStr}`);
    } else {
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

export function generateICal(tasks: Task[], listName = "VibeList"): string {
  const now = new Date();
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VibeList//VibeList Task Manager//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeICalText(listName)}`,
    `X-VIBELIST-EXPORT:${format(now, "yyyy-MM-dd'T'HH:mm:ss'Z'")}`,
    "METHOD:PUBLISH",
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
  a.download = `vibelist-${format(new Date(), "yyyy-MM-dd")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
