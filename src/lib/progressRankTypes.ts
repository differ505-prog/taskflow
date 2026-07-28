/**
 * progressRankTypes.ts — Pro 等級型別
 */

export interface ProgressLevel {
  /** 等級數字 (I=1, II=2, ..., VI=6) */
  tier: number;
  /** 等級代號 (I/II/III/IV/V/VI) */
  code: "I" | "II" | "III" | "IV" | "V" | "VI";
  /** 中文顯示標籤（例如「Pro 等級 III」） */
  label: string;
  /** 該等級最低 PP（含） */
  min: number;
  /** 下一等級最低 PP（不含）；Infinity 代表已是最高等級 */
  max: number;
  /** 視覺色彩 token */
  color: string;
}
