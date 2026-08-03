/**
 * 第三方登入 provider 啟用配置
 *
 * 為什麼需要這個檔(2026-08-04 用戶反饋):
 * - Supabase 專案目前沒啟用 Apple provider,但 UI 仍有 Apple 按鈕
 * - 用戶按 Apple 會拿到 400 "Unsupported provider: provider is not enabled"
 * - 此檔提供「display-layer」開關:UI 自動對齊 Supabase 啟用狀態
 *
 * 啟用方式:
 * - 預設全 false(對應目前 Supabase 專案只啟用 Google + Email)
 * - 想啟用 Apple → 改下方程式 + Supabase Dashboard → Authentication → Providers → Apple
 *   設定 Services ID (Apple Developer Console) + Secret Key
 * - 想啟用其他 provider → 新增下方程式 + 對應 UI 入口
 */

export const AUTH_PROVIDERS = {
  google: {
    enabled: true,
    label: "Google",
  },
  apple: {
    // 預設關閉:目前 Supabase 專案未啟用 Apple,避免使用者按到失敗入口
    enabled: false,
    label: "Apple",
  },
} as const;

export type AuthProvider = keyof typeof AUTH_PROVIDERS;
