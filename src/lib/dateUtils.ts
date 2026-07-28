/**
 * 本地時區日期工具
 *
 * 設計原則:整個 habit/today 邏輯統一使用「本地時區」的 YYYY-MM-DD 字串,
 * 不用 `toISOString()`(UTC),避免跨日邊界(凌晨 0-8 點 UTC+8)habit 寫入與讀取比對失敗。
 *
 * §相關:
 * - WarmupSection.checkinHabit 寫入端(原本就用本地)
 * - HabitsPage today 比對 + heatmap 30 天陣列
 * - AppContext.computeHabitStreak 的 today/yesterday 比對
 */
export function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD(本地時區)
}

/**
 * 從 Date 物件生成本地 YYYY-MM-DD 字串
 * 用於「從某個 Date 物件產生對應日期字串」的場景(如 heatmap 30 天遞迴)
 */
export function toLocalDateString(d: Date): string {
  return d.toLocaleDateString("en-CA");
}
