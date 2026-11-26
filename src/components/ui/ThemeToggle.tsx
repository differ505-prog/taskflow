"use client";

/**
 * ThemeToggle — 主題感知的開關（淺色 / 深色模式都清楚可見）
 *
 * 舊寫法用 `bg-black/10` 當未開啟的軌道底色，在深色模式下幾乎隱形，
 * 使用者會以為開關已經打開。這裡改用 `var(--surface-hover)` + `var(--border)`，
 * 全部走 CSS token，深色模式自動對比。
 */
interface ThemeToggleProps {
  checked: boolean;
  onChange: () => void;
  /** 無障礙標籤，例如「啟用自訂紅線提醒」 */
  ariaLabel: string;
}

export function ThemeToggle({ checked, onChange, ariaLabel }: ThemeToggleProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
      />
      <div
        className="w-11 h-6 rounded-full transition-colors border"
        style={{
          background: checked ? "var(--brand)" : "var(--surface-hover)",
          borderColor: "var(--border)",
        }}
      />
      <div
        className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
        style={{ transform: checked ? "translateX(20px)" : undefined }}
      />
    </label>
  );
}
