/**
 * progressRank.ts — Pro 等級進步系統（純函式）
 *
 * 設計原則：
 * 1. **永不倒扣**：PP 只進不出。沒上線不會扣點數,徹底消除焦慮
 * 2. **單一維度**：只追蹤 PP,不引入多維屬性（避免認知負擔）
 * 3. **6 等級**：Pro I → II → III → IV → V → VI,門檻清楚（見 PROGRESS_LEVELS）
 * 4. **可調常數**：BASE_TASK_PP 抽出,日後可依業務調整單次獎勵
 */

import type { ProgressLevel } from "./progressRankTypes";

/**
 * 單次完成任務獲得的基礎 PP（Productivity Points）
 */
export const BASE_TASK_PP = 100;

/**
 * 單次完成暖身習慣獲得的基礎 PP
 */
export const BASE_HABIT_PP = 10;

/**
 * 6 等級 PP 門檻表
 */
export const PROGRESS_LEVELS: readonly ProgressLevel[] = [
  { tier: 1, code: "I",   label: "Pro 等級 I",   min: 0,     max: 500,    color: "#94a3b8" },
  { tier: 2, code: "II",  label: "Pro 等級 II",  min: 500,   max: 1500,   color: "#64748b" },
  { tier: 3, code: "III", label: "Pro 等級 III", min: 1500,   max: 3500,   color: "#3b82f6" },
  { tier: 4, code: "IV",  label: "Pro 等級 IV",  min: 3500,   max: 7000,   color: "#a855f7" },
  { tier: 5, code: "V",   label: "Pro 等級 V",   min: 7000,   max: 15000,  color: "#ec4899" },
  { tier: 6, code: "VI",  label: "Pro 等級 VI",  min: 15000,  max: Infinity, color: "#f59e0b" },
] as const;

/**
 * 根據 totalPp 計算當前等級（含進度資訊）
 */
export function calculateProgressLevel(totalPp: number) {
  const safePp = Math.max(0, totalPp);
  const level = [...PROGRESS_LEVELS].reverse().find((r) => safePp >= r.min) ?? PROGRESS_LEVELS[0];
  const nextLevel = PROGRESS_LEVELS[level.tier] ?? null;
  const needed = nextLevel ? nextLevel.min - safePp : 0;
  const spanInCurrentLevel = nextLevel ? nextLevel.min - level.min : 1;
  const current = safePp - level.min;
  const progress = nextLevel ? Math.min(1, Math.max(0, current / spanInCurrentLevel)) : 1;

  return {
    level,
    nextLevel,
    current,
    needed,
    progress,
    totalPp: safePp,
  };
}

/**
 * 判斷新 PP 是否跨越升級門檻
 */
export function didLevelUp(prevPp: number, newPp: number): ProgressLevel | null {
  const prev = calculateProgressLevel(prevPp);
  const next = calculateProgressLevel(newPp);
  if (next.level.tier > prev.level.tier) return next.level;
  return null;
}
