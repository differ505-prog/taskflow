"use client";

import { useState } from "react";
import { haptic } from "@/lib/haptics";
import { Zap } from "lucide-react";

interface FocusNowButtonProps {
  /** 點擊後觸發一鍵入禪（更新任務 + router.push）。若 undefined,按鈕 disabled。 */
  onFocusNow?: () => void;
  /** 顯示提示文字（hover tooltip / aria-label） */
  label?: string;
}

/**
 * FocusNowButton — 「一鍵入禪 (Focus NOW)」極簡 icon button
 *
 * §26 設計意圖:
 * - 預設極低調 (text-slate-300 / opacity-0 group-hover:opacity-100),不干擾任務名稱閱讀
 * - hover 才亮起 (hover:bg-slate-100 hover:text-slate-600)
 * - 點擊瞬間 haptic 回饋 + 按鈕本身 scale-95(「抓取」暗示,在路由切換前先視覺回饋)
 *
 * 用法:在 TaskListItem / TaskCard 的右上 quick actions 區放此按鈕,
 *       由呼叫端決定行為(個人任務 updateTask + router.push,shared list 可傳 disabled tooltip)。
 */
export function FocusNowButton({ onFocusNow, label = "一鍵入禪" }: FocusNowButtonProps) {
  const disabled = !onFocusNow;
  const [pressed, setPressed] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    haptic("selection"); // 輕盈的「啟動」感,不是 success(完成保留)也不是 warning
    setPressed(true);
    onFocusNow!();
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
      <Zap className="w-3.5 h-3.5" />
    </button>
  );
}