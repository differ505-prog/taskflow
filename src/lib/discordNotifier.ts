/**
 * discordNotifier.ts — 創業者多巴胺：系統級 Discord Webhook 通知
 *
 * 藍圖需求：
 * - 新用戶註冊時，發送通知
 * - 首個任務完成時，發送通知
 * - 累積用戶達 50 人後，自動停止實時推播，切換為「每日晚間 10 點」總結報表
 *
 * 資安原則（§8）：
 * - DISCORD_WEBHOOK_URL 存於 .env.local，絕不 hardcode
 * - API route server-side 代理，隱藏 webhook URL
 *
 * 觸發時機（由調用方控制）：
 * - AuthContext 註冊成功 → 呼叫 notifyNewUser()
 * - AppContext 首個任務完成 → 呼叫 notifyFirstTaskDone()
 */

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const USER_THRESHOLD = 50; // 實時推播門檻
const DAILY_SUMMARY_HOUR = 22; // 晚間 10 點

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

/**
 * 發送 Discord Webhook（Server-side only）
 */
async function sendDiscord(embeds: DiscordEmbed[]): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.warn("[discordNotifier] DISCORD_WEBHOOK_URL not configured");
    return false;
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "TaskFlow Bot",
        avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=taskflow",
        embeds,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[discordNotifier] Failed to send:", err);
    return false;
  }
}

/**
 * 顏色工具：hex → decimal（Discord embed 用）
 */
function hexToDecimal(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

// Brand color
const BRAND_COLOR = hexToDecimal("#3B82F6");
const SUCCESS_COLOR = hexToDecimal("#22C55E");
const WARNING_COLOR = hexToDecimal("#F59E0B");

/**
 * 新用戶註冊通知
 * 調用方：AuthContext /api/auth/callback
 */
export async function notifyNewUser(email: string, provider?: string): Promise<void> {
  if (!WEBHOOK_URL) return;

  const timestamp = new Date().toISOString();
  const providerLabel = provider ? `（${provider}）` : "";

  const embed: DiscordEmbed = {
    title: "🎉 新用戶註冊",
    description: `**${email}** ${providerLabel}剛剛加入 TaskFlow！`,
    color: BRAND_COLOR,
    fields: [
      {
        name: "📧 信箱",
        value: email,
        inline: true,
      },
      {
        name: "🔐 登入方式",
        value: provider || "Email/Password",
        inline: true,
      },
    ],
    footer: {
      text: "TaskFlow — 創業者多巴胺引擎",
    },
    timestamp,
  };

  await sendDiscord([embed]);
}

/**
 * 首個任務完成通知
 * 觸發條件：該用戶歷史上從未完成過任何任務，這是第一次
 * 調用方：AppContext（toggleTaskStatus）
 */
export async function notifyFirstTaskDone(
  email: string,
  taskTitle: string,
  userCount: number
): Promise<void> {
  if (!WEBHOOK_URL) return;

  // 超過門檻 → 降級為摘要模式（不在此實作，由外部 scheduler 處理）
  const inSummaryMode = userCount >= USER_THRESHOLD;

  const timestamp = new Date().toISOString();

  const embed: DiscordEmbed = {
    title: "🚀 首個任務完成！",
    description: `**${email}** 剛完成了「${taskTitle}」，吃下自己的狗糧！`,
    color: SUCCESS_COLOR,
    fields: [
      {
        name: "✅ 任務",
        value: taskTitle.length > 50 ? taskTitle.slice(0, 47) + "..." : taskTitle,
        inline: false,
      },
      {
        name: "👤 用戶",
        value: email,
        inline: true,
      },
      {
        name: "📊 總用戶數",
        value: `${userCount}`,
        inline: true,
      },
    ],
    footer: {
      text: inSummaryMode
        ? `⚠️ 已達 ${USER_THRESHOLD} 人，實時推播已關閉，請留意每日總結報表`
        : `TaskFlow — 實時推播模式 (門檻: ${USER_THRESHOLD} 人)`,
    },
    timestamp,
  };

  await sendDiscord([embed]);
}

/**
 * 每日總結報表（由外部 cron/scheduler 呼叫）
 * 格式：今日新註冊人數、任務完成數、活躍用戶
 */
export async function notifyDailySummary(data: {
  newUsers: number;
  tasksCompleted: number;
  activeUsers: number;
  date: string;
}): Promise<void> {
  if (!WEBHOOK_URL) return;

  const { newUsers, tasksCompleted, activeUsers, date } = data;

  const embed: DiscordEmbed = {
    title: `📊 TaskFlow 每日總結 — ${date}`,
    description: "創業者多巴胺引擎每日戰報",
    color: WARNING_COLOR,
    fields: [
      {
        name: "🆕 新註冊",
        value: `${newUsers} 人`,
        inline: true,
      },
      {
        name: "✅ 任務完成",
        value: `${tasksCompleted} 項`,
        inline: true,
      },
      {
        name: "🔥 活躍用戶",
        value: `${activeUsers} 人`,
        inline: true,
      },
    ],
    footer: {
      text: "TaskFlow — 每日晚間 10 點自動發送",
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscord([embed]);
}
