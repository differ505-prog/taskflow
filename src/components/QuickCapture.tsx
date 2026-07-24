"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/AppContext";

/**
 * QuickCapture — 禪模式專用「一鍵捕捉」輸入框
 *
 * 設計目標(對應教練 §10.3 評分 9.3 方案):
 * 1. 零阻力:底部固定輸入框,Enter 送出,送出後靜默發送至 Inbox
 * 2. 零干擾:送出後不開 modal、不開 sheet、不離開禪模式
 * 3. 焦點保護:微動畫「已丟進收件箱 ✦」,0.6s 自動收回,絕不打斷 flow
 * 4. 全域快捷鍵 Cmd/Ctrl + K 自動 focus(在任何頁面)
 * 5. IME safe:onKeyDown + isComposing 檢查避免中文模式雙觸發
 * 6. a11y:aria-live="polite" 通知成功
 * 7. mobile safe area:底部 padding 避 iOS home indicator
 *
 * 「靜默發送」路徑:listId: undefined = 收件箱(addTask 內部已無 modal)
 */

export interface QuickCaptureProps {
  /** 接收外部 focus 要求的 ref handle(由 useQuickCapture 快捷鍵 hook 用) */
  focusRef?: React.MutableRefObject<(() => void) | null>;
}

export function QuickCapture({ focusRef }: QuickCaptureProps) {
  const { addTask } = useApp();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [successFlash, setSuccessFlash] = useState<0 | 1 | 2>(0);
  const flashTimerRef = useRef<number | null>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // §26 預設最低優級「delegate」,讓 Inbox 裡的捕捉任務不出現於「今天」禪模式
    addTask({
      title: trimmed,
      status: "todo",
      priority: "delegate",
      listId: undefined, // 收件箱
      tags: [],
    });
    setValue("");
    setSuccessFlash((c) => (c + 1) as 0 | 1 | 2);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setSuccessFlash(0), 600);
  }, [value, addTask]);

  // §15.4 mobile input:Enter on keydown + isComposing 防 IME 雙觸發
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      if (e.nativeEvent.isComposing) return; // IME 組字中不觸發
      e.preventDefault();
      handleSubmit();
    },
    [handleSubmit],
  );

  // 對外暴露 focus 介面給快捷鍵 hook
  useEffect(() => {
    if (!focusRef) return;
    focusRef.current = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    return () => {
      focusRef.current = null;
    };
  }, [focusRef]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg ring-1 ring-slate-200/60 backdrop-blur-md transition-all duration-200 ease-out focus-within:ring-slate-400">
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-base"
          aria-hidden
          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
        >
          ＋
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="想到了什麼？立刻捕捉到收件箱"
          aria-label="快速捕捉任務到收件箱"
          className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        <span
          aria-live="polite"
          aria-atomic="true"
          className={`flex-shrink-0 text-[11px] font-medium transition-opacity duration-200 ease-out ${
            successFlash ? "opacity-100 text-emerald-600" : "opacity-0"
          }`}
        >
          {successFlash ? "✦ 已投遞" : ""}
        </span>
        <kbd
          className="hidden items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200/60 sm:inline-flex"
          aria-hidden
        >
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </div>
    </div>
  );
}
