"use client";

import { useState } from "react";
import { haptic } from "@/lib/haptics";
import { Sun } from "lucide-react";

interface AddToTodayButtonProps {
  /** 點擊後觸發加入今日。undefined = disabled。 */
  onAddToToday?: () => void;
  /** 自訂 tooltip / aria-label(預設「加入今日」) */
  label?: string;
}

/**
 * AddToTodayButton — 「加入今日」極簡 icon button
 *
 * 設計對齊 §26 原 FocusNowButton:
 * - 預設極低調 (text-slate-300 / opacity-0 group-hover:opacity-100)
 * - hover 才亮起 (hover:bg-slate-100 hover:text-slate-600)
 * - 點擊瞬間 haptic 回饋 + 按鈕 scale-95
 *
 * T2-b 統一行為:與手機版 SwipeableTaskCard 太陽按鈕完全同語意
 * - 點擊 → addToToday hook → dueDate = today
 * - 不跳頁、不搶 Zen 焦點
 * - 桌面/手機/LostAndFound 等場景共用同一行為
 */
export function AddToTodayButton({ onAddToToday, label = "加入今日" }: AddToTodayButtonProps) {
  const disabled = !onAddToToday;
  const [pressed, setPressed] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    haptic("selection");
    setPressed(true);
    onAddToToday!();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? "此視圖尚未啟用" : label}
      aria-label={label}
      className={`
        p-1 rounded-lg transition-all duration-150
        text-slate-300 hover:bg-slate-100 hover:text-slate-600
        opacity-0 group-hover:opacity-100 focus-visible:opacity-100
        disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300
        ${pressed ? "scale-95" : "active:scale-90"}
      `}
    >
      <Sun className="w-3.5 h-3.5" />
    </button>
  );
}
