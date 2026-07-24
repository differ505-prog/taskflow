/**
 * presenceMock — 估算活躍獵人範圍
 *
 * 品牌承諾:真實與脆弱（Authenticity & Vulnerability）
 * - 永遠回傳「範圍」而非精確數字(不假裝是即時 WebSocket)
 * - 不做抖動(§2:不需要頻繁變動)
 * - 純函式,將來接真實 API 只換 import(§25 reuse)
 *
 * 文案規範:主畫面必須顯示「估計目前有 X-Y 位獵人同步專注」,
 * hover tooltip 必須揭露「這是估算」以建立信任
 */

/** 估算的人數範圍 */
export interface PresenceRange {
  min: number;
  max: number;
}

/**
 * 根據當前時間,回傳估算的活躍獵人範圍
 *
 * 為什麼用 time-of-day 帶狀分佈:
 * - 早上 8-10 顯示 30-50 人:感覺「工作時段有同伴」
 * - 深夜顯示 5-15 人:不假裝「半夜 50 人」(會被一眼看穿)
 * - 範圍而非精確數字:符合「真實」品牌
 *
 * 為什麼不做 setInterval 重算:
 * - Spec 明說「不需要頻繁變動」
 * - 跨小時邊界的微小不準確可接受(已是估算)
 * - mount 一次計算,符合「保持代碼簡潔」
 *
 * @param currentTime 用戶裝置當前時間(new Date())
 */
export function getEstimatedActiveHunters(currentTime: Date): PresenceRange {
  const hour = currentTime.getHours();

  // 深夜 (0-5):深度睡眠,活躍用戶少
  if (hour >= 0 && hour < 5) return { min: 5, max: 15 };
  // 清晨 (5-7):少數早起鳥
  if (hour >= 5 && hour < 7) return { min: 10, max: 25 };
  // 早高峰 (7-10):上班/上學前暖身
  if (hour >= 7 && hour < 10) return { min: 30, max: 55 };
  // 上午 (10-12):工作巔峰
  if (hour >= 10 && hour < 12) return { min: 40, max: 70 };
  // 午間 (12-13):用餐低谷
  if (hour >= 12 && hour < 13) return { min: 25, max: 45 };
  // 下午 (13-17):穩定生產
  if (hour >= 13 && hour < 17) return { min: 35, max: 65 };
  // 傍晚 (17-19):下班轉換
  if (hour >= 17 && hour < 19) return { min: 28, max: 52 };
  // 晚上 (19-22):自學/自由工作者黃金時段
  if (hour >= 19 && hour < 22) return { min: 32, max: 58 };
  // 深夜前夕 (22-24):慢慢減少
  return { min: 12, max: 32 };
}