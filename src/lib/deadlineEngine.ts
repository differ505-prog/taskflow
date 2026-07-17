/**
 * 死線引擎 (Deadline Engine)
 *
 * 計算「截止日期」對使用者而言的緊迫程度，並回傳視覺化用的狀態物件。
 * 帕金森定律（Parkinson's Law）：工作會自動膨脹以填滿可用時間。
 * 因此截止日越近，視覺警示越強烈，幫助使用者正視即將到期的工作。
 *
 * @see https://en.wikipedia.org/wiki/Parkinson%27s_law
 */

export type DeadlineSeverity = "overdue" | "critical" | "warning" | "normal";

export interface DeadlineStatus {
  severity: DeadlineSeverity;
  text: string;          // 給人類看的文案（如「剩 5 小時」、「剩 3 天」、「已過期 2 天」）
  tooltip: string;       // 帕金森定律對應文案
  colorVar: string;      // CSS var token,不要直接發明色碼
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const TOOLTIPS: Record<DeadlineSeverity, string> = {
  overdue: "帕金森定律:工作總是膨脹到最後一刻。重新評估能否如期完成。",
  critical: "帕金森定律:24 小時倒數已開始。今天處理掉，別再拖。",
  warning: "帕金森定律:還有緩衝時間,但已開始收窄。建議今天動手。",
  normal: "帕金森定律:時間充裕,但別掉以輕心。",
};

/**
 * 從 dueDate + dueTime 計算 deadline Date 物件。
 * 若 dueTime 為空，預設為當天 23:59（一天的最後一刻）。
 */
function resolveDeadlineDate(dueDate: string, dueTime?: string): Date | null {
  if (!dueDate) return null;
  try {
    const [y, m, d] = dueDate.split("-").map(Number);
    if (!y || !m || !d) return null;
    let hour = 23;
    let minute = 59;
    if (dueTime && /^\d{2}:\d{2}$/.test(dueTime)) {
      const [hh, mm] = dueTime.split(":").map(Number);
      hour = hh;
      minute = mm;
    }
    return new Date(y, m - 1, d, hour, minute, 0, 0);
  } catch {
    return null;
  }
}

/**
 * 計算單一任務的死線狀態。
 *
 * 規則：
 * - 已過期（< 0h）→ overdue,紅色「已過期 X 天」
 * - < 24h → critical,紅色「剩 X 小時」
 * - 24-72h → warning,橘色「剩 X 天」
 * - > 72h → normal,灰色靜態日期
 *
 * @param dueDate  YYYY-MM-DD
 * @param dueTime  HH:mm（可選）
 * @param isDone   已完成任務不顯示緊迫狀態
 * @param now      注入用（測試友善）
 */
export function getDeadlineStatus(
  dueDate: string | undefined,
  dueTime: string | undefined,
  isDone: boolean = false,
  now: Date = new Date()
): DeadlineStatus | null {
  if (!dueDate) return null;
  if (isDone) return null;

  const deadline = resolveDeadlineDate(dueDate, dueTime);
  if (!deadline) return null;

  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / HOUR_MS;
  const diffDays = Math.floor(diffMs / DAY_MS);

  // 已過期
  if (diffMs < 0) {
    const overdueDays = Math.floor(Math.abs(diffMs) / DAY_MS);
    const overdueHours = Math.floor(Math.abs(diffMs) / HOUR_MS);
    const text = overdueDays >= 1 ? `已過期 ${overdueDays} 天` : `已過期 ${overdueHours} 小時`;
    return {
      severity: "overdue",
      text,
      tooltip: TOOLTIPS.overdue,
      colorVar: "var(--status-danger)",
    };
  }

  // < 24h:critical
  if (diffHours < 24) {
    const hours = Math.max(1, Math.floor(diffHours));
    return {
      severity: "critical",
      text: `剩 ${hours} 小時`,
      tooltip: TOOLTIPS.critical,
      colorVar: "var(--status-danger)",
    };
  }

  // 24-72h:warning
  if (diffHours < 72) {
    const days = Math.max(1, diffDays);
    return {
      severity: "warning",
      text: `剩 ${days} 天`,
      tooltip: TOOLTIPS.warning,
      colorVar: "var(--status-warning)",
    };
  }

  // > 72h:normal（不顯示緊迫狀態,保留現有靜態日期 pill）
  return null;
}