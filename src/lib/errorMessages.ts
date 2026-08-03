/**
 * 錯誤訊息翻譯層（SSOT — 對齊 VOICE_AND_TONE.md §5）
 *
 * 設計原則：
 * 1. 永遠給「發生了什麼 + 下一步」，全段 ≤ 35 字
 * 2. 不曝露內部錯誤代碼（SQLSTATE、HTTP 4xx、stack）給使用者
 * 3. 不說「失敗」「錯誤」這種焦慮詞；用「需要再試」「換個方式」這種中性詞
 *
 * 用法：
 *   toast.error(translateAuthError(e));
 *   toast.error(translatePushError(sub, "subscribe"));
 *   toast.error(translateNetworkError(e));
 */

export function translateAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Invalid login credentials")) return "Email 或密碼錯誤";
  if (msg.includes("Email not confirmed")) return "請先至信箱點擊驗證連結";
  if (msg.includes("already registered")) return "此 Email 已被註冊";
  if (msg.includes("Password should be at least")) return "密碼至少需要 6 個字元";
  if (msg.includes("rate limit")) return "請求過於頻繁,稍後再試";
  if (msg.includes("valid email")) return "Email 格式不正確";
  if (msg.includes("not found")) return "查無此 Email 帳號";
  if (msg.includes("canceled")) return "已取消";
  if (msg.includes("User already registered")) return "此 Email 已被註冊";
  return "需要再試一次";
}

export function translatePushError(
  e: unknown,
  scenario: "subscribe" | "unsubscribe" | "reset" | "test" = "subscribe",
): string {
  const msg = e instanceof Error ? e.message : String(e);
  // iOS-specific 場景（行動裝置 user 需要明確引導）
  if (msg.includes("NotAllowedError") || msg.includes("denied")) {
    return "推播被拒絕,到 iOS 設定 → Safari 開啟";
  }
  if (msg.includes("AbortError") || msg.includes("permission dismissed")) {
    return "通知權限視窗被略過,請用 Safari 一般 tab 開站一次並允許";
  }
  if (msg.includes("subscription expired") || msg.includes("expired")) {
    return "訂閱已過期,請重新授權通知";
  }
  if (msg.includes("no subscription")) return "瀏覽器端沒有訂閱";
  // 通用網路 / 伺服器錯誤 → 中性引導
  return scenario === "subscribe" ? "訂閱需要再試一次" : "取消失敗,稍後再試";
}

export function translateNetworkError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("timeout") || msg.includes("Timeout")) return "網路連線逾時,稍後再試";
  if (msg.includes("NetworkError") || msg.includes("Failed to fetch")) {
    return "網路不穩,稍後再試";
  }
  return "連線出了點問題,稍後再試";
}

export function translateSupabaseError(e: unknown, fallback = "需要再試一次"): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("duplicate key")) return "資料已存在";
  if (msg.includes("foreign key")) return "資料被引用,無法刪除";
  if (msg.includes("permission denied")) return "沒有權限";
  if (msg.includes("not found") || msg.includes("404")) return "資料不存在";
  return fallback;
}
