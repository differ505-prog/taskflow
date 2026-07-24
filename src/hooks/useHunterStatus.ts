"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculateHunterRank, didLevelUp, BASE_TASK_EXP } from "@/lib/hunterRank";
import type { HunterRank } from "@/lib/hunterRankTypes";

/**
 * useHunterStatus — 獵人公會狀態 Hook（localStorage 版本）
 *
 * 設計動機（提示詞明確要求）：
 * - 「未來切 Supabase 只動這個 Hook,UI 完全不動」
 * - localStorage 暫存 totalExp,跨 session 保留
 *
 * 當前實作：localStorage
 * 限制：跨裝置不同步（明確揭露,見 §21 優化清單後續）
 *
 * 切換到 Supabase 時的 migration plan：
 * - 將 STORAGE_KEY 改為從 Supabase `profiles.total_exp` 讀寫
 * - 保留相同 export 介面:{ totalExp, rankInfo, addExp, currentRank }
 * - 加 subscribe-on-mount 同步跨裝置變化
 */

const STORAGE_KEY = "vibelist:totalExp";

/**
 * SSR-safe 讀取 localStorage
 */
function readFromStorage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeToStorage(value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.floor(value))));
  } catch {
    // quota exceeded / private mode → silently ignore,下次 reload 從 0 開始
  }
}

export interface AddExpResult {
  /** 本次新增後的 totalExp */
  newTotal: number;
  /** 本次獲得的 EXP delta */
  delta: number;
  /** 升級目標階級（若有）;null 代表未升級 */
  leveledUpTo: HunterRank | null;
}

export interface UseHunterStatusReturn {
  /** 當前總 EXP */
  totalExp: number;
  /** 階級完整資訊（含進度） */
  rankInfo: ReturnType<typeof calculateHunterRank>;
  /** 當前階級 shorthand */
  currentRank: HunterRank;
  /** 增加 EXP 並回報升級狀態；單次任務完成時呼叫,delta 由呼叫方決定（預設 BASE_TASK_EXP） */
  addExp: (delta?: number) => AddExpResult;
  /** 強制設定總 EXP（測試 / debug 用,UI 流程不應直接呼叫） */
  setTotalExp: (value: number) => void;
}

export function useHunterStatus(): UseHunterStatusReturn {
  // 用 lazy initializer 確保 SSR/CSR 第一次 render 一致（0）
  // 真正的 localStorage 值會在 mount 後 effect 同步進來
  const [totalExp, setTotalExpState] = useState(0);
  const hydratedRef = useRef(false);

  // Mount 後讀 localStorage（client-only,避免 SSR hydration mismatch）
  useEffect(() => {
    const stored = readFromStorage();
    setTotalExpState(stored);
    hydratedRef.current = true;
  }, []);

  // 跨分頁同步（其他 tab 完成任務也要看到 EXP 變化）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const next = Number.parseInt(e.newValue, 10);
        if (Number.isFinite(next) && next >= 0) setTotalExpState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addExp = useCallback(
    (delta: number = BASE_TASK_EXP): AddExpResult => {
      const safeDelta = Math.max(0, Math.floor(delta));
      const prev = totalExp;
      const next = prev + safeDelta;
      setTotalExpState(next);
      writeToStorage(next);
      const leveledUpTo = didLevelUp(prev, next);
      return { newTotal: next, delta: safeDelta, leveledUpTo };
    },
    [totalExp],
  );

  const setTotalExp = useCallback((value: number) => {
    const safe = Math.max(0, Math.floor(value));
    setTotalExpState(safe);
    writeToStorage(safe);
  }, []);

  const rankInfo = calculateHunterRank(totalExp);

  return {
    totalExp,
    rankInfo,
    currentRank: rankInfo.rank,
    addExp,
    setTotalExp,
  };
}