"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculateProgressLevel, didLevelUp, BASE_TASK_PP } from "@/lib/progressRank";
import type { ProgressLevel } from "@/lib/progressRankTypes";

/**
 * useProgressStatus — Pro 等級進步 Hook（localStorage 版本）
 *
 * 當前實作：localStorage
 * 限制：跨裝置不同步
 *
 * 切換到 Supabase 時：
 * - 將 STORAGE_KEY 改為從 Supabase `profiles.total_pp` 讀寫
 * - 保留相同 export 介面:{ totalPp, levelInfo, addPp, currentLevel }
 */

const STORAGE_KEY = "vibelist:totalPp";

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
    // quota exceeded / private mode → silently ignore
  }
}

export interface AddPpResult {
  newTotal: number;
  delta: number;
  leveledUpTo: ProgressLevel | null;
}

export interface UseProgressStatusReturn {
  totalPp: number;
  levelInfo: ReturnType<typeof calculateProgressLevel>;
  currentLevel: ProgressLevel;
  addPp: (delta?: number) => AddPpResult;
  setTotalPp: (value: number) => void;
}

export function useProgressStatus(): UseProgressStatusReturn {
  const [totalPp, setTotalPpState] = useState(0);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = readFromStorage();
    setTotalPpState(stored);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const next = Number.parseInt(e.newValue, 10);
        if (Number.isFinite(next) && next >= 0) setTotalPpState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addPp = useCallback(
    (delta: number = BASE_TASK_PP): AddPpResult => {
      const safeDelta = Math.max(0, Math.floor(delta));
      const prev = totalPp;
      const next = prev + safeDelta;
      setTotalPpState(next);
      writeToStorage(next);
      const leveledUpTo = didLevelUp(prev, next);
      return { newTotal: next, delta: safeDelta, leveledUpTo };
    },
    [totalPp],
  );

  const setTotalPp = useCallback((value: number) => {
    const safe = Math.max(0, Math.floor(value));
    setTotalPpState(safe);
    writeToStorage(safe);
  }, []);

  const levelInfo = calculateProgressLevel(totalPp);

  return {
    totalPp,
    levelInfo,
    currentLevel: levelInfo.level,
    addPp,
    setTotalPp,
  };
}
