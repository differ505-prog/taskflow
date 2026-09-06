/**
 * 主題系統共用邏輯
 *
 * 給兩處共用：
 * 1. src/app/layout.tsx 的 <head> inline script（reload 時同步套用，避免白閃）
 * 2. SettingsPage 的 handleThemeChange（用戶切換時即時套用）
 *
 * 不要在這裡讀 React state 或 hook —— 必須可在純 JS 環境執行。
 */

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "taskflow_theme";

export function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = t === "dark" || (t === "system" && prefersDark);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "");
}
