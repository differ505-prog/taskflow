"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAndCacheExternalCalendar,
  readAllExternalCalendarCaches,
  mergeExternalCalendarCounts,
  getStoredExternalCalendarUrls,
  removeStoredExternalCalendar,
  getCalendarFetchedAt,
} from "@/lib/icsImport";

/**
 * useExternalCalendar — 拉取 + 快取 + polling 外部日曆 ICS URL
 *
 * 設計原則：
 * 1. localStorage 是 source of truth,記憶體 state 是它的鏡像
 * 2. 不主動暴露 fetch 細節,只回傳「資料 + 動作」
 * 3. polling 在 visibility change + mount 時觸發,不在背景跑(節省電)
 * 4. 任何錯誤都不會 throw,而是回傳 ok:false + error 字串
 */

export interface ExternalCalendarAPI {
  /** 已加入的外部日曆 URL 列表 */
  urls: string[];
  /** 合併後的 date → 事件數 map(所有已加入日曆合計) */
  dateCountMap: Record<string, number>;
  /** 每個 URL 個別的 date → 事件數(給 SettingsPage 預覽用) */
  perUrlCounts: Record<string, Record<string, number>>;
  /** 每個 URL 的最後成功拉取時間(ms epoch) */
  perUrlFetchedAt: Record<string, number>;
  /** 是否正在 fetch */
  loading: boolean;
  /** 上次錯誤訊息(若有) */
  error: string | null;
  /** 新增 URL + 立即拉取一次 */
  addUrl: (url: string) => Promise<{ ok: boolean; eventCount?: number; error?: string }>;
  /** 移除 URL */
  removeUrl: (url: string) => void;
  /** 手動重新拉取所有已存 URL(給「重新整理」按鈕) */
  refreshAll: () => Promise<void>;
}

const POLL_THROTTLE_MS = 15 * 60 * 1000; // 15 分鐘

export function useExternalCalendar(): ExternalCalendarAPI {
  const [urls, setUrls] = useState<string[]>([]);
  const [perUrlCounts, setPerUrlCounts] = useState<Record<string, Record<string, number>>>({});
  const [perUrlFetchedAt, setPerUrlFetchedAt] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPollRef = useRef<number>(0);

  // ─── 讀 localStorage 同步到 state ────────────────────────
  const syncFromStorage = useCallback(() => {
    const all = readAllExternalCalendarCaches();
    const nextUrls = Object.keys(all);
    const nextCounts: Record<string, Record<string, number>> = {};
    const nextFetchedAt: Record<string, number> = {};
    for (const url of nextUrls) {
      nextCounts[url] = all[url].dateCountMap;
      nextFetchedAt[url] = all[url].fetchedAt;
    }
    setUrls(nextUrls);
    setPerUrlCounts(nextCounts);
    setPerUrlFetchedAt(nextFetchedAt);
  }, []);

  // ─── Mount:同步 + 排程 polling ────────────────────────
  useEffect(() => {
    syncFromStorage();
    // 不在 mount 立刻 fetch — 給使用者「打開 Settings 再按重新整理」的機會
    // 改在 visibilitychange / 每 15 分鐘輪詢時觸發
  }, [syncFromStorage]);

  // ─── Visibility change 觸發 polling(PWA 喚醒場景,§24.1 / §26-K)───
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastPollRef.current < POLL_THROTTLE_MS) return;
      lastPollRef.current = now;
      void refreshAllInternal();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAllInternal = useCallback(async () => {
    const stored = getStoredExternalCalendarUrls();
    if (stored.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    let lastErr: string | null = null;
    for (const url of stored) {
      if (controller.signal.aborted) break;
      const result = await fetchAndCacheExternalCalendar(url, { signal: controller.signal });
      if (!result.ok && result.error) {
        lastErr = result.error;
      }
    }
    syncFromStorage();
    setLoading(false);
    setError(lastErr);
  }, [syncFromStorage]);

  const addUrl = useCallback(
    async (url: string) => {
      setLoading(true);
      setError(null);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await fetchAndCacheExternalCalendar(url, { signal: controller.signal });
      syncFromStorage();
      setLoading(false);

      if (!result.ok) {
        setError(result.error ?? "未知錯誤");
        return { ok: false, error: result.error };
      }
      const eventCount = result.dateCountMap
        ? Object.values(result.dateCountMap).reduce((a, b) => a + b, 0)
        : 0;
      return { ok: true, eventCount };
    },
    [syncFromStorage],
  );

  const removeUrl = useCallback(
    (url: string) => {
      removeStoredExternalCalendar(url);
      syncFromStorage();
    },
    [syncFromStorage],
  );

  const refreshAll = useCallback(async () => {
    lastPollRef.current = Date.now();
    await refreshAllInternal();
  }, [refreshAllInternal]);

  // ─── 聚合所有 URL 的 count map ────────────────────────
  const dateCountMap = mergeExternalCalendarCounts(urls);

  // 元件 unmount 時清掉任何 in-flight fetch
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    urls,
    dateCountMap,
    perUrlCounts,
    perUrlFetchedAt,
    loading,
    error,
    addUrl,
    removeUrl,
    refreshAll,
  };
}

/**
 * 純函式 helper:取得某 URL 的「最後更新 X 分鐘前」字串(給 UI 顯示)
 * 從 hook 外部用,避免每次重渲染都呼叫
 */
export function formatFetchedAgo(fetchedAt: number | null): string {
  if (!fetchedAt) return "尚未拉取";
  const ms = Date.now() - fetchedAt;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}