"use client";

import { useApp } from "@/lib/AppContext";
import { useDueDateReminder } from "@/hooks/useDueDateReminder";

/**
 * B1: 包裝 useDueDateReminder,在 AppProviders 內 mount 一次。
 * 為什麼獨立成元件:hook 需要 useApp() 取 tasks,必須在 AppProvider
 * 子樹內;但 AppProviders 已用 useAuth,無法直接呼叫 useApp(同一
 * 元件內不能用兩個 context hook?其實可以,但拆出去更乾淨)。
 */
export function DueDateReminderWatcher() {
  const { tasks } = useApp();
  useDueDateReminder(tasks);
  return null;
}
