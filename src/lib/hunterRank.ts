/**
 * hunterRank.ts — 獵人公會階級系統（純函式）
 *
 * 設計原則（§10.3 9.5 方案，與提示詞嚴格對齊）：
 * 1. **永不倒扣**：EXP 只進不出。沒上線不會扣經驗值,徹底消除「連勝中斷焦慮」
 * 2. **單一維度**：只追蹤 EXP,不引入力量/敏捷/智力等多維屬性（避免認知負擔）
 * 3. **6 階級**：E → D → C → B → A → S,門檻清楚（見 HUNTER_RANKS）
 * 4. **可調常數**：BASE_TASK_EXP 抽出,日後可依業務調整單次任務獎勵
 *
 * 為什麼這是純函式 util：
 * - 易測試（無 React / Zustand / localStorage 依賴）
 * - 易在 server / client 共用（未來 Supabase RPC 端也能 import）
 * - 未來切 Supabase 時,UI 元件只需改 useHunterStatus,不用動這支
 */

import type { HunterRank } from "./hunterRankTypes";

/**
 * 單次完成任務獲得的基礎 EXP
 * 抽成常數以便日後全局調整（提示詞明確要求）
 */
export const BASE_TASK_EXP = 100;

/**
 * 單次完成暖身習慣獲得的基礎 EXP
 * 比任務低 10 倍(任務 100 vs 習慣 10),強調「微量多巴胺」而非主要進度源
 * 設計哲學:Habit 是「啟動暖身」,不是「主進度」
 */
export const BASE_HABIT_EXP = 10;

/**
 * 6 階級 EXP 門檻表（提示詞規格）
 * - min:晉升到該階級所需最低 EXP（含）
 * - max:晉升到下一階級所需 EXP（不含,Infinity 代表最高階級）
 * - tier:階級數字（E=1, D=2, ..., S=6）
 * - color:該階級的視覺色彩（slate 系低彩度為主,避免視覺喧賓奪主）
 */
export const HUNTER_RANKS: readonly HunterRank[] = [
  { tier: 1, code: "E", label: "E 級獵人", min: 0, max: 500, color: "#94a3b8" },
  { tier: 2, code: "D", label: "D 級獵人", min: 500, max: 1500, color: "#64748b" },
  { tier: 3, code: "C", label: "C 級獵人", min: 1500, max: 3500, color: "#3b82f6" },
  { tier: 4, code: "B", label: "B 級獵人", min: 3500, max: 7000, color: "#a855f7" },
  { tier: 5, code: "A", label: "A 級獵人", min: 7000, max: 15000, color: "#ec4899" },
  { tier: 6, code: "S", label: "S 級獵人", min: 15000, max: Infinity, color: "#f59e0b" },
] as const;

/**
 * 根據 totalExp 計算當前階級（含進度資訊）
 *
 * @example
 *   calculateHunterRank(0)     // { rank: E, current: 0, needed: 500, progress: 0 }
 *   calculateHunterRank(250)   // { rank: E, current: 250, needed: 500, progress: 0.5 }
 *   calculateHunterRank(8000)  // { rank: A, current: 1000, needed: 8000, progress: 0.125 }
 */
export function calculateHunterRank(totalExp: number) {
  // 邊界保護：負數視為 0(配合「永不倒扣」)
  const safeExp = Math.max(0, totalExp);

  // 由高到低找第一個 min <= safeExp 的階級
  const rank = [...HUNTER_RANKS].reverse().find((r) => safeExp >= r.min) ?? HUNTER_RANKS[0];

  // 下一階級（最高階級時 current 即等於 totalExp）
  const nextRank = HUNTER_RANKS[rank.tier] ?? null; // tier 是 index,S 級的 tier=5 → HUNTER_RANKS[5] 不存在
  const needed = nextRank ? nextRank.min - safeExp : 0;
  const spanInCurrentRank = nextRank ? nextRank.min - rank.min : 1; // S 級用 1 防 /0
  const current = safeExp - rank.min;
  const progress = nextRank ? Math.min(1, Math.max(0, current / spanInCurrentRank)) : 1;

  return {
    rank,
    nextRank,
    current, // 在當前階級內已累積的 EXP
    needed, // 距下一階級還差多少 EXP（0 = 已達最高階級）
    progress, // 0..1,給進度條用
    totalExp: safeExp,
  };
}

/**
 * 判斷新 EXP 是否跨越升級門檻
 *
 * @returns 升級目標階級（含）,若未升級則 null
 *
 * @example
 *   didLevelUp(450, 550)  // { tier: 2, code: 'D', ... }（E → D）
 *   didLevelUp(1500, 1800) // null（仍在 C 級）
 */
export function didLevelUp(prevExp: number, newExp: number): HunterRank | null {
  const prev = calculateHunterRank(prevExp);
  const next = calculateHunterRank(newExp);
  if (next.rank.tier > prev.rank.tier) return next.rank;
  return null;
}