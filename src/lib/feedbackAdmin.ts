/**
 * feedbackAdmin.ts — 開發者後台(/admin/feedback)用的反饋管理工具
 *
 * 設計動機(§A 修正):
 *   前版 FeedbackButton 把「複製 + AI 整理」放在使用者 modal,使用者不需要這功能。
 *   本檔把 prompt + 批次組裝邏輯**只 export 給 admin 後台**,前端使用者 bundle 不會包含。
 *
 * 對齊既有 pattern(§25):
 *   - `FEEDBACK_LLM_PROMPT` 從 feedbackContext.ts 搬來,只在此 lib export
 *   - status 標籤中文對照對齊 supabase migration 0015 的 enum:new / reviewed / archived / spurious
 *
 * 反覆根因預防(§26):
 *   - §P 雙 persona UI 混用:本檔**禁止**被 FeedbackButton import,只供 /admin/* 路由使用
 *   - §L navigator.clipboard:複製走 clipboard.writeText(Vercel HTTPS 環境原生支援),失敗 fallback execCommand
 */

import type { FeedbackContextPayload } from "@/lib/feedbackContext";

/**
 * LLM 整理 prompt 模板(只給開發者後台用)。
 * 按下「📋 複製 + AI 整理」時,組裝成完整 markdown 貼到 Cursor / Claude 即可批次整理。
 */
export const FEEDBACK_LLM_PROMPT = `以下是 VibeList 封測/公測期用戶反饋批次,請幫忙歸納:

1. **重複出現的問題**:依出現次數排序,標出每個問題的代表訊息
2. **熱區路由/元件**:哪個路由 / 元件最常被提及
3. **優先級建議**:P0(必修)/ P1(下個迭代)/ P2(可有可無)
4. **新功能建議**:哪些值得做(已用戶主動提)
5. **假訊號過濾**:哪些是 spurious / 噪音 / 使用者誤會

回應格式:中文 markdown,每條結論附原始反饋編號。

---

`;

/** Supabase feedback 表的資料列型別(對齊 0015_feedback.sql) */
export interface FeedbackRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  message: string;
  context: FeedbackContextPayload | Record<string, unknown>;
  status: "new" | "reviewed" | "archived" | "spurious";
  category: string | null;
  created_at: string;
  updated_at: string;
}

/** Status 標籤(中文 + 顏色 token) */
export const STATUS_LABEL: Record<FeedbackRow["status"], { label: string; tone: string }> = {
  new: { label: "新", tone: "var(--brand)" },
  reviewed: { label: "已看", tone: "var(--text-secondary)" },
  archived: { label: "歸檔", tone: "var(--text-tertiary)" },
  spurious: { label: "假訊號", tone: "var(--status-warning)" },
};

/** 篩選器選項(all + 4 種 status) */
export type FeedbackFilter = "all" | FeedbackRow["status"];
export const FILTER_OPTIONS: { value: FeedbackFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "new", label: "新" },
  { value: "reviewed", label: "已看" },
  { value: "archived", label: "歸檔" },
  { value: "spurious", label: "假訊號" },
];

/**
 * 把多筆反饋組裝成給 LLM 整理的 markdown。
 * 每一筆包含:id / 時間 / user / route / message / context 摘要 / console errors。
 */
export function buildFeedbackMarkdown(rows: FeedbackRow[]): string {
  if (rows.length === 0) return FEEDBACK_LLM_PROMPT + "(沒有選擇任何反饋)";
  const blocks = rows.map((r, idx) => {
    const ctx = (r.context ?? {}) as Partial<FeedbackContextPayload>;
    const consoleErrors = ctx.recentConsoleErrors ?? 0;
    const route = ctx.route ?? "(無 route)";
    const appVersion = ctx.appVersion ?? "";
    const collectedAt = ctx.collectedAt ?? r.created_at;
    const lastActions = Array.isArray(ctx.lastActions) ? ctx.lastActions : [];
    const lastConsoleErrors = Array.isArray(ctx.lastConsoleErrors) ? ctx.lastConsoleErrors : [];

    const lines = [
      `### ${idx + 1}. [${r.id.slice(0, 8)}] ${r.message || "(無訊息)"}`,
      ``,
      `- **用戶**: ${r.user_email ?? "訪客"} (${r.user_role ?? "free"})`,
      `- **狀態**: ${STATUS_LABEL[r.status].label}`,
      `- **建立**: ${r.created_at}`,
      `- **Route**: \`${route}\``,
      appVersion ? `- **App 版本**: ${appVersion}` : null,
      `- **Collected**: ${collectedAt}`,
      `- **Console errors**: ${consoleErrors}`,
      lastConsoleErrors.length > 0
        ? `- **最近 console errors**:\n${lastConsoleErrors
            .map(
              (c: { level?: string; message?: string; ts?: string }) =>
                `  - [${c.level ?? "log"}] ${c.message ?? ""} @ ${c.ts ?? ""}`
            )
            .join("\n")}`
        : null,
      lastActions.length > 0
        ? `- **最後操作**:\n${lastActions
            .map(
              (a: { type?: string; payload?: unknown; ts?: string }) =>
                `  - ${a.type ?? "?"}: ${JSON.stringify(a.payload ?? {}).slice(0, 120)} @ ${a.ts ?? ""}`
            )
            .join("\n")}`
        : null,
      ``,
    ].filter(Boolean);
    return lines.join("\n");
  });
  return FEEDBACK_LLM_PROMPT + blocks.join("\n---\n\n");
}

/**
 * 複製文字到剪貼簿(對齊 §L navigator.clipboard pattern)。
 * 成功回傳 true,失敗回傳 false。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
