"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Task } from "@/lib/types";

/**
 * B1 到期提醒 hook
 *
 * 設計動機:用戶設了 dueDate 但 app 沒主動通知,任務就會被忘記 —
 * 對 ADHD 用戶更是災難。本 hook 每 60 秒掃描 tasks,根據 dueDate /
 * dueTime 計算剩餘時間,在三個時點觸發 toast:
 *
 *  - 1 小時前(有 dueTime 才會觸發,沒時間不知道何時觸發)
 *  - 今天到期(早上 9:00 一次性提醒)
 *  - 明天到期(早上 9:00 一次性提醒)
 *
 * §L1-L4 LostAndFound 情緒包裝:絕不顯示「過期」「逾期」「未完成」
 * 字眼;視覺用「🍃 風鈴提示」取代「⚠️ 警告」;只預設最多每任務同階
 * 段提醒一次(用 localStorage 去重,key 帶日期避免跨日重複)。
 *
 * 注意:hook 內部呼叫 toast(),無返回值。需在 AppProviders mount 一次。
 */

const REMINDER_STORAGE_KEY = "taskflow:due_reminder_log:v1";

interface ReminderLog {
  // key = `${taskId}:${stage}:${date}`,value = true
  [key: string]: boolean;
}

type ReminderStage = "1h" | "today" | "tomorrow";

function loadLog(): ReminderLog {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLog(log: ReminderLog): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // localStorage 滿了 / 隱私模式,靜默失敗
  }
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function shouldFireStage1h(task: Task): boolean {
  if (!task.dueDate || !task.dueTime) return false;
  const due = new Date(`${task.dueDate}T${task.dueTime}:00`);
  if (isNaN(due.getTime())) return false;
  const now = Date.now();
  const diffMs = due.getTime() - now;
  // 剩 45-60 分鐘這個區間觸發(避免每分鐘重複檢查時重複彈)
  return diffMs > 45 * 60 * 1000 && diffMs <= 60 * 60 * 1000;
}

function shouldFireStageToday(task: Task, todayStr: string): boolean {
  if (!task.dueDate) return false;
  if (task.dueDate !== todayStr) return false;
  const now = new Date();
  // 早上 9 點之後才提醒,避免凌晨就彈當天提醒
  return now.getHours() >= 9;
}

function shouldFireStageTomorrow(task: Task, tomorrowStr: string): boolean {
  if (!task.dueDate) return false;
  return task.dueDate === tomorrowStr;
}

function buildLogKey(taskId: string, stage: ReminderStage, dateStr: string): string {
  return `${taskId}:${stage}:${dateStr}`;
}

export function useDueDateReminder(tasks: Task[]) {
  const logRef = useRef<ReminderLog>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    logRef.current = loadLog();
  }, []);

  useEffect(() => {
    const tick = () => {
      const todayStr = todayDateString();
      const tomorrowStr = tomorrowDateString();
      const log = logRef.current;
      let dirty = false;

      for (const task of tasks) {
        if (task.status === "done") continue;
        if (task.isArchived) continue;

        // Stage 1: 1 小時前
        if (shouldFireStage1h(task)) {
          const key = buildLogKey(task.id, "1h", todayStr);
          if (!log[key]) {
            log[key] = true;
            dirty = true;
            toast(`⏰ 再 1 小時:${task.title}${task.dueTime ? `(${task.dueTime})` : ""}`, {
              duration: 5000,
              id: `reminder-1h-${task.id}`,
              description: "風鈴提示 · 該準備了 🍃",
            });
          }
        }

        // Stage 2: 今天到期
        if (shouldFireStageToday(task, todayStr)) {
          const key = buildLogKey(task.id, "today", todayStr);
          if (!log[key]) {
            log[key] = true;
            dirty = true;
            toast(`📌 今天到期:${task.title}`, {
              duration: 5000,
              id: `reminder-today-${task.id}`,
              description: "風鈴提示 · 今天把它收進口袋 🍃",
            });
          }
        }

        // Stage 3: 明天到期
        if (shouldFireStageTomorrow(task, tomorrowStr)) {
          const key = buildLogKey(task.id, "tomorrow", tomorrowStr);
          if (!log[key]) {
            log[key] = true;
            dirty = true;
            toast(`🌅 明天到期:${task.title}`, {
              duration: 5000,
              id: `reminder-tomorrow-${task.id}`,
              description: "風鈴提示 · 提前為明天留一盞燈 🍃",
            });
          }
        }
      }

      if (dirty) {
        logRef.current = log;
        saveLog(log);
      }
    };

    // 立即跑一次 + 之後每 60 秒
    tick();
    intervalRef.current = setInterval(tick, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tasks]);
}
