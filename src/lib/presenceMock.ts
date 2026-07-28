/**
 * presenceMock — 估算活躍用戶範圍
 *
 * 品牌承諾:真實與脆弱（Authenticity & Vulnerability）
 * - 永遠回傳「範圍」而非精確數字(不假裝是即時 WebSocket)
 * - 不做抖動(§2:不需要頻繁變動)
 * - 純函式,將來接真實 API 只換 import(§25 reuse)
 *
 * 文案規範:主畫面必須顯示「估計目前有 X-Y 位用戶同步專注」,
 * hover tooltip 必須揭露「這是估算」以建立信任
 */

/** 估算的人數範圍 */
export interface PresenceRange {
  min: number;
  max: number;
}

/**
 * 根據當前時間,回傳估算的活躍用戶範圍
 */
export function getEstimatedActiveUsers(currentTime: Date): PresenceRange {
  const hour = currentTime.getHours();

  if (hour >= 0 && hour < 5) return { min: 5, max: 15 };
  if (hour >= 5 && hour < 7) return { min: 10, max: 25 };
  if (hour >= 7 && hour < 10) return { min: 30, max: 55 };
  if (hour >= 10 && hour < 12) return { min: 40, max: 70 };
  if (hour >= 12 && hour < 13) return { min: 25, max: 45 };
  if (hour >= 13 && hour < 17) return { min: 35, max: 65 };
  if (hour >= 17 && hour < 19) return { min: 28, max: 52 };
  if (hour >= 19 && hour < 22) return { min: 32, max: 58 };
  return { min: 12, max: 32 };
}
