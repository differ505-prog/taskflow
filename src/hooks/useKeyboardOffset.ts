"use client";

import { useEffect, useState } from "react";

/**
 * 偵測 mobile 視覺鍵盤彈起,回傳鍵盤遮住的高度 (px)。
 * - keyboard > 0 表示鍵盤彈起
 * - 不支援 visualViewport 的瀏覽器 (desktop) → 永遠回傳 0,不影響 desktop UX
 *
 * 用法：
 *   const keyboard = useKeyboardOffset();
 *   <div style={{ paddingBottom: keyboard > 0 ? keyboard : basePadding }}>
 */
export function useKeyboardOffset(): number {
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // window.innerHeight - visualViewport.height ≈ 鍵盤佔的高度
      // 但 iOS URL bar 收合時 visualViewport.height 可能比 window.innerHeight 大,
      // 需用 max(0, ...) 防負值
      const offset = Math.max(0, window.innerHeight - vv.height);
      setKeyboard(offset);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return keyboard;
}