"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculateProgressLevel, didLevelUp, BASE_TASK_PP } from "@/lib/progressRank";
import type { ProgressLevel } from "@/lib/progressRankTypes";
import { useAuth } from "@/lib/AuthContext";
import {
  loadTotalPp,
  saveTotalPp,
  subscribeTotalPp,
} from "@/lib/progressRankSync";

/**
 * useProgressStatus — Pro 等級進步 Hook
 *
 * 持久化層：Supabase `user_progress` 表（取代 localStorage）
 *   - loadTotalPp(uid)：登入後一次性讀取雲端值
 *   - saveTotalPp(uid, n)：本地 addPp 後背景推送雲端（樂觀更新）
 *   - subscribeTotalPp(uid, cb)：realtime 訂閱跨裝置變更
 *
 * 訪客模式（未登入）：降級用 localStorage，避免破壞訪客體驗
 *
 * 跨裝置同步保證（§26-A 5 秒保護窗）：
 *   - 本地 addPp 後 5 秒內，雲端 echo 即使 total_pp 較舊也忽略
 *   - 避免「剛升級又被雲端舊值覆蓋」
 */

const LEGACY_STORAGE_KEY = "vibelist:totalPp";
const LOCAL_SYNC_EVENT = "vibelist:pp_sync";
/** 本地最近寫入的時間戳 + 值 — 用於 ignore-stale-cloud-echo */
const RECENT_WRITE_MS = 5000;

function readLegacyFromStorage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function clearLegacyStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
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
  // 初始值：嘗試讀 legacy localStorage（訪客模式 + 登入前首次 render）
  const [totalPp, setTotalPpState] = useState<number>(() => readLegacyFromStorage());

  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const hydratedRef = useRef(false);
  /** 最近一次本地寫入的 timestamp + value，用於保護窗 */
  const lastLocalWriteRef = useRef<{ at: number; value: number } | null>(null);
  /** 已 migrate 旗標，避免重複把 legacy localStorage 推上雲 */
  const migratedRef = useRef(false);

  // 同步同一個瀏覽器標籤頁內的所有 hook instance
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      setTotalPpState(customEvent.detail);
      lastLocalWriteRef.current = { at: Date.now(), value: customEvent.detail };
    };
    window.addEventListener(LOCAL_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(LOCAL_SYNC_EVENT, handleSync);
  }, []);

  const setTotalPp = useCallback((value: number) => {
    const safe = Math.max(0, Math.floor(value));
    setTotalPpState(safe);
    lastLocalWriteRef.current = { at: Date.now(), value: safe };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(LOCAL_SYNC_EVENT, { detail: safe }));
    }
    if (uid) {
      void saveTotalPp(uid, safe);
    } else {
      try {
        window.localStorage.setItem(LEGACY_STORAGE_KEY, String(safe));
      } catch {
        // ignore
      }
    }
  }, [uid]);

  // 登入後：一次性讀雲端 + 訂閱 realtime + migrate legacy localStorage
  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const cloudValue = await loadTotalPp(uid);
      if (cancelled) return;

      // Migrate：若 localStorage 有既有值，取 max 推上雲（避免覆蓋更高進度）
      const legacyValue = readLegacyFromStorage();
      if (!migratedRef.current && legacyValue > 0) {
        migratedRef.current = true;
        const merged = Math.max(cloudValue, legacyValue);
        setTotalPpState(merged);
        lastLocalWriteRef.current = { at: Date.now(), value: merged };
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(LOCAL_SYNC_EVENT, { detail: merged }));
        }
        await saveTotalPp(uid, merged);
        clearLegacyStorage();
      } else {
        setTotalPpState(cloudValue);
        lastLocalWriteRef.current = { at: Date.now(), value: cloudValue };
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(LOCAL_SYNC_EVENT, { detail: cloudValue }));
        }
        hydratedRef.current = true;
      }

      // Realtime 訂閱跨裝置變更
      unsubscribe = await subscribeTotalPp(uid, (next) => {
        // §26-A 保護窗：本地剛寫入 5 秒內，若雲端 echo 較舊則忽略
        const recent = lastLocalWriteRef.current;
        if (recent && Date.now() - recent.at < RECENT_WRITE_MS) {
          if (next <= recent.value) return;
        }
        setTotalPpState(next);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(LOCAL_SYNC_EVENT, { detail: next }));
        }
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [uid]);

  const addPp = useCallback(
    (delta: number = BASE_TASK_PP): AddPpResult => {
      const safeDelta = Math.max(0, Math.floor(delta));
      const prev = totalPp;
      const next = prev + safeDelta;
      setTotalPpState(next);
      lastLocalWriteRef.current = { at: Date.now(), value: next };
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(LOCAL_SYNC_EVENT, { detail: next }));
      }
      
      const leveledUpTo = didLevelUp(prev, next);

      // 背景推雲端（fire-and-forget；保留本地同步 UX）
      if (uid) {
        void saveTotalPp(uid, next);
      } else {
        try {
          window.localStorage.setItem(LEGACY_STORAGE_KEY, String(next));
        } catch {
          // ignore
        }
      }

      return { newTotal: next, delta: safeDelta, leveledUpTo };
    },
    [totalPp, uid],
  );

  const levelInfo = calculateProgressLevel(totalPp);

  return {
    totalPp,
    levelInfo,
    currentLevel: levelInfo.level,
    addPp,
    setTotalPp,
  };
}