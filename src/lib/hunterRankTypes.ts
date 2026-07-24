/**
 * hunterRankTypes.ts — 獵人階級型別
 *
 * 與 hunterRank.ts 拆開,讓 util 不依賴 React 型別,
 * 也方便 server / client 端共用
 */

export interface HunterRank {
  /** 階級數字(E=1, D=2, C=3, B=4, A=5, S=6) */
  tier: number;
  /** 階級代號(E/D/C/B/A/S) */
  code: "E" | "D" | "C" | "B" | "A" | "S";
  /** 中文顯示標籤(例如「E 級獵人」) */
  label: string;
  /** 該階級最低 EXP(含) */
  min: number;
  /** 下一階級最低 EXP(不含);Infinity 代表已是最高階級 */
  max: number;
  /** 視覺色彩 token */
  color: string;
}