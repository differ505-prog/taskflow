"use client";

/**
 * useDiscordNotifier — 創業者多巴胺：前端通知觸發鉤子
 *
 * 用法：
 *   const { notifyNewUser, notifyFirstTaskDone } = useDiscordNotifier();
 *
 * 工作原理：
 * - 透過 /api/discord/notify 代理，避免前端暴露 webhook URL
 * - Rate limiting 由 API route 處理
 * - 失敗靜默，不污染 UX
 */

/**
 * 通知新用戶註冊
 */
export async function notifyNewUser(email: string, provider?: string): Promise<void> {
  try {
    await fetch("/api/discord/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "new_user", email, provider }),
      // fire-and-forget，失敗不阻塞
      keepalive: true,
    });
  } catch {
    // §8: 失敗靜默
  }
}

/**
 * 通知首個任務完成
 */
export async function notifyFirstTaskDone(
  email: string,
  taskTitle: string,
  userCount: number
): Promise<void> {
  try {
    await fetch("/api/discord/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "first_task_done", email, taskTitle, userCount }),
      keepalive: true,
    });
  } catch {
    // §8: 失敗靜默
  }
}
