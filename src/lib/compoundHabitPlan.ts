/**
 * 高回報複利實驗 — 領域模組（純 TypeScript，無 React / 無 DOM 依賴）
 *
 * 設計原則：
 *   1. 「一次只專注一個實驗」— 防 ADHD 貪多棄坑（1-Slot 閥門）
 *   2. 復盤筆記必須「可雙向還原」— 寫得下去，也要讀得回來
 *   3. 文案溫柔，不使用責備語氣（「過期」「逾期」「失敗」）
 */

import type { Habit } from "@/lib/types";

/** 複利實驗方案標記（掛在 habit.sourcePlan 上，供「整套退場」安全卸除） */
export const COMPOUND_PLAN = {
  id: "plan-compound-12",
  name: "高回報複利實驗",
} as const;

export type CompoundPlanId = typeof COMPOUND_PLAN.id;

/** 單一實驗範本（使用者可挑選其一開啟） */
export interface CompoundHabitTemplate {
  /** 範本識別碼（不與實際 habit.id 衝突） */
  id: string;
  title: string;
  description: string;
  frequency: Habit["frequency"];
  /** 每個番茄的專注分鐘數 */
  pomodoroMinutes: number;
  /** 每日投入目標（分鐘） */
  dailyTargetMinutes: number;
  /** 習慣卡片色（hex） */
  color: string;
  /** 一句話「微不適」提示 — 說明這個實驗為什麼值得忍一下 */
  discomfortHint: string;
}

/**
 * 4 個精選實驗（依「高回報 × 低摩擦」篩選）
 * - 每日：睡前 100 字決策復盤 ＋ 一句真話（#1 + #12）
 * - 每日：30 分鐘無螢幕深度思考（#3）
 * - 每日：每天一件微不適小事（#6）
 * - 每週：弱關係問候 ＋ 資產盤點（#2 + #8）
 */
export const COMPOUND_HABIT_TEMPLATES: readonly CompoundHabitTemplate[] = [
  {
    id: "compound-habit-daily-review",
    title: "睡前 100 字決策復盤 ＋ 一句真話",
    description:
      "今天的每個重要決定，寫下你選了什麼、發生了什麼、下次怎麼改。最後補一句對自己誠實的話。",
    frequency: "daily",
    pomodoroMinutes: 10,
    dailyTargetMinutes: 10,
    color: "#4F6AF5",
    discomfortHint: "寫的時候會想不起理由 — 那正是最有價值的部分。",
  },
  {
    id: "compound-habit-deep-think",
    title: "30 分鐘無螢幕深度思考",
    description:
      "把手機放遠，選一個卡住你很久的問題，靜靜想 30 分鐘。想不出結論也算數。",
    frequency: "daily",
    pomodoroMinutes: 30,
    dailyTargetMinutes: 30,
    color: "#0EA5E9",
    discomfortHint: "前 10 分鐘會很躁 — 熬過去，念頭會自己變清楚。",
  },
  {
    id: "compound-habit-tiny-friction",
    title: "每天一件微不適小事",
    description:
      "刻意做一件你一直想逃避、但其實無關緊要的小事。做完記一句感受。",
    frequency: "daily",
    pomodoroMinutes: 5,
    dailyTargetMinutes: 5,
    color: "#F97316",
    discomfortHint: "不適感會在 24 小時內退潮 — 勇氣其實很便宜。",
  },
  {
    id: "compound-habit-weak-tie-audit",
    title: "弱關係問候 ＋ 資產盤點",
    description:
      "問候一位久未聯絡的人（真誠、不群發），再盤點一次你的資產與純消耗。每週一次就夠。",
    frequency: "weekly",
    pomodoroMinutes: 20,
    dailyTargetMinutes: 0,
    color: "#8B5CF6",
    discomfortHint: "開口的那一下最難 — 對方通常比你更意外收到訊息。",
  },
] as const;

/**
 * 找出目前「進行中」的複利實驗（未封存 + 屬於本方案）。
 * 回傳第一筆；沒有則回傳 null。
 */
export function getActiveCompoundExperiment(habits: Habit[]): Habit | null {
  if (!Array.isArray(habits)) return null;
  return (
    habits.find(
      (h) =>
        !!h &&
        !h.archivedAt &&
        h.sourcePlan?.id === COMPOUND_PLAN.id
    ) ?? null
  );
}

/**
 * 1-Slot 閥門：同時最多 1 個進行中實驗。
 * - allowed === false 時，activeHabit 指向正在進行中的那一個
 * - allowed === true 時，activeHabit 為 null
 */
export function canActivateCompoundExperiment(habits: Habit[]): {
  allowed: boolean;
  activeHabit: Habit | null;
} {
  const activeHabit = getActiveCompoundExperiment(habits);
  return { allowed: activeHabit === null, activeHabit };
}

/** 復盤筆記的欄位結構 */
export interface ReflectionFields {
  decision: string;
  outcome: string;
  nextStep: string;
  hardTruth?: string;
}

const LABEL_TO_KEY: Record<string, keyof ReflectionFields> = {
  決定: "decision",
  結果: "outcome",
  下次: "nextStep",
  真話: "hardTruth",
};

const KEY_TO_LABEL: Record<keyof ReflectionFields, string> = {
  decision: "決定",
  outcome: "結果",
  nextStep: "下次",
  hardTruth: "真話",
};

/**
 * 把復盤欄位組成純文字筆記。
 * 空白欄位直接略過（不留下「決定：」這種空殼行）。
 */
export function buildReflectionNote(fields: ReflectionFields): string {
  const order: (keyof ReflectionFields)[] = [
    "decision",
    "outcome",
    "nextStep",
    "hardTruth",
  ];
  const lines: string[] = [];
  for (const key of order) {
    const raw = fields?.[key];
    const value = (raw ?? "").trim();
    if (!value) continue;
    lines.push(`${KEY_TO_LABEL[key]}：${value}`);
  }
  return lines.join("\n");
}

/**
 * 解析復盤筆記，還原成欄位。
 * 相容於 `buildReflectionNote` 的輸出，也容忍手動輸入的非標準行。
 */
export function parseReflectionNote(note?: string): ReflectionFields {
  const result: ReflectionFields = {
    decision: "",
    outcome: "",
    nextStep: "",
    hardTruth: "",
  };
  if (!note || !note.trim()) return result;

  for (const rawLine of note.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([^：:]+)[：:]\s*(.*)$/.exec(line);
    if (!match) {
      // 無標籤的行 → 併入「決定」，避免內容遺失
      if (!result.decision) result.decision = line;
      continue;
    }
    const label = match[1].trim();
    const value = match[2].trim();
    const key = LABEL_TO_KEY[label];
    if (key) {
      result[key] = value;
    } else if (!result.decision) {
      result.decision = line;
    }
  }
  return result;
}

/**
 * 判斷某習慣是否為「需要睡前復盤」的對象
 * （標題含「復盤」或屬於本方案的進行中實驗）
 */
export function isReflectionHabit(habit: Habit): boolean {
  if (!habit || habit.archivedAt) return false;
  if (habit.sourcePlan?.id === COMPOUND_PLAN.id) return true;
  return habit.title.includes("復盤");
}
