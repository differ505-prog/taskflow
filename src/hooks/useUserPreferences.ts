"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useUserPreferences — 用戶偏好設定（localStorage 版本）
 *
 * 設計動機：
 * - 「未來切 Supabase 只動這個 Hook,UI 完全不動」
 * - 沿用 useHunterStatus 的「SSR-safe lazy init」pattern(§25 reuse)
 * - localStorage 暫存,跨 session 保留
 *
 * 切換到 Supabase 時的 migration plan：
 * - 將 STORAGE_KEY 改為從 Supabase `profiles.preferences` 讀寫
 * - 保留相同 export 介面:{ defaultView, setDefaultView }
 * - 加 subscribe-on-mount 同步跨裝置變化
 *
 * Anti-pattern 防護(對齊 global.mdc §1-3)：
 * - §1 不在這 hook 內加雜七雜八的設定(字體大小、顏色主題) — 只放 defaultView
 * - §2 預設值 = "zen",出廠預設即禪模式
 * - §3 不寫任何「警告」邏輯
 */

export type DefaultView = "zen" | "board";

const STORAGE_KEY = "vibelist_default_view";

/**
 * SSR-safe 讀取 localStorage
 */
function readFromStorage(): DefaultView {
  if (typeof window === "undefined") return "zen";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "board") return "board";
    return "zen";
  } catch {
    return "zen";
  }
}

function writeToStorage(value: DefaultView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // quota exceeded / private mode → silently ignore
  }
}

export interface UseUserPreferencesReturn {
  /** 當前預設啟動畫卷 */
  defaultView: DefaultView;
  /** 設定預設啟動畫卷 */
  setDefaultView: (value: DefaultView) => void;
  /** 是否已完成首次 hydration（SSR 結束後） */
  isHydrated: boolean;
}

/**
 * 用戶偏好設定 Hook
 * - 提供 defaultView 當前值 + setter
 * - SSR 期間回傳預設值 "zen"(出廠預設)
 * - Mount 後從 localStorage 同步進來
 * - 跨分頁同步(其他 tab 修改也能即時反映)
 */
export function useUserPreferences(): UseUserPreferencesReturn {
  const [defaultView, setDefaultViewState] = useState<DefaultView>("zen");
  const [isHydrated, setIsHydrated] = useState(false);

  // Mount 後讀 localStorage（client-only,避免 SSR hydration mismatch）
  useEffect(() => {
    setDefaultViewState(readFromStorage());
    setIsHydrated(true);
  }, []);

  // 跨分頁同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setDefaultViewState(readFromStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDefaultView = useCallback((value: DefaultView) => {
    setDefaultViewState(value);
    writeToStorage(value);
  }, []);

  return {
    defaultView,
    setDefaultView,
    isHydrated,
  };
}