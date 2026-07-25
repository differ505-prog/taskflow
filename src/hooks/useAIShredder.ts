"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useAIShredder — AI 任務粉碎機 Hook
 *
 * 設計動機:
 * - 「AI 拆解任務」是 ADHD 殺手級功能,需要前端速率限制 + 跨日重置
 * - 沿用 useHunterStatus 模式:localStorage SSR-safe + 跨分頁 storage event
 * - API call 沿用 useTagRename 模式:fetch POST /api/shred + loading/error
 *
 * 限流策略:
 * - 前端 (本 Hook):localStorage 追蹤當日使用次數,上限 3 次/日,跨日自動歸零
 *   用途:友善提示「今日剩餘 X 次」,避免用戶一直按浪費 API
 * - 後端 (API Route):IP rate limit + 登入驗證 作為真正防線
 *
 * 為什麼是 3 次?
 * - 提示詞明確要求:「預設上限為 3 次」
 * - ADHD 友善:夠用 + 強迫「不是所有事都要 AI 拆解」
 */

const STORAGE_KEY = "vibelist:aiShredderDaily";
const DAILY_LIMIT = 3;

interface DailyUsage {
  /** YYYY-MM-DD,用於跨日偵測 */
  date: string;
  /** 當日累計使用次數 */
  count: number;
}

/**
 * 回傳當天日期字串 (YYYY-MM-DD,本地時區)
 * 跨日偵測用:就算用戶跨午夜仍在同一 session,也要歸零
 */
function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * SSR-safe 讀取 localStorage
 * - SSR 時一定回傳 0 (避免 hydration mismatch)
 * - 跨日自動歸零(讀到昨天的資料 → 視為 0)
 */
function readDailyUsage(): DailyUsage {
  if (typeof window === "undefined") return { date: getTodayDate(), count: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: getTodayDate(), count: 0 };
    const parsed = JSON.parse(raw) as Partial<DailyUsage>;
    if (parsed.date !== getTodayDate()) {
      // 跨日 → 歸零
      return { date: getTodayDate(), count: 0 };
    }
    return {
      date: getTodayDate(),
      count: typeof parsed.count === "number" && parsed.count >= 0 ? parsed.count : 0,
    };
  } catch {
    return { date: getTodayDate(), count: 0 };
  }
}

function writeDailyUsage(usage: DailyUsage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // quota / private mode → silently ignore
  }
}

export interface UseAIShredderReturn {
  /** 當前已使用次數 (本日) */
  usedCount: number;
  /** 今日剩餘可用次數 */
  remainingCount: number;
  /** 今日上限 (固定 3) */
  dailyLimit: number;
  /** 是否已達上限 */
  isLimitReached: boolean;
  /** 是否正在呼叫 AI */
  loading: boolean;
  /** 錯誤訊息 (null = 無錯誤) */
  error: string | null;
  /**
   * 呼叫 AI 拆解任務
   * @param title 任務標題
   * @returns 拆解出的步驟陣列;若失敗回傳 null
   */
  shred: (title: string) => Promise<string[] | null>;
  /** 手動重置計數 (測試 / debug 用,UI 流程不應直接呼叫) */
  resetUsage: () => void;
}

export function useAIShredder(): UseAIShredderReturn {
  // 用 lazy initializer 確保 SSR/CSR 第一次 render 一致 (0)
  // 真正的 localStorage 值會在 mount 後 effect 同步進來
  const [usage, setUsage] = useState<DailyUsage>({
    date: getTodayDate(),
    count: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  // Mount 後讀 localStorage (client-only,避免 SSR hydration mismatch)
  useEffect(() => {
    setUsage(readDailyUsage());
    hydratedRef.current = true;
  }, []);

  // 跨分頁同步 (其他 tab 用了 AI 拆解,也要看到次數變化)
  // 跨午夜偵測:每分鐘檢查一次日期,跨日自動歸零 (即使 storage event 沒觸發)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setUsage(readDailyUsage());
      }
    };
    window.addEventListener("storage", onStorage);

    // 跨日偵測 timer
    const intervalId = window.setInterval(() => {
      const current = readDailyUsage();
      if (current.date !== usage.date || current.count !== usage.count) {
        setUsage(current);
      }
    }, 60_000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
    };
  }, [usage.date, usage.count]);

  const resetUsage = useCallback(() => {
    const fresh: DailyUsage = { date: getTodayDate(), count: 0 };
    setUsage(fresh);
    writeDailyUsage(fresh);
  }, []);

  const shred = useCallback(
    async (title: string): Promise<string[] | null> => {
      // 1. 客戶端先擋 (即使後端有限流,前端擋掉能省一次網路)
      if (usage.count >= DAILY_LIMIT) {
        setError(`今日已用完 ${DAILY_LIMIT} 次上限,明天再來試試看 💪`);
        return null;
      }

      const trimmed = title.trim();
      if (!trimmed) {
        setError("任務標題不可為空");
        return null;
      }
      if (trimmed.length > 200) {
        setError("任務標題過長,請縮短至 200 字以內");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/shred", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          const message = body.error ?? `HTTP ${res.status}`;
          // 401/503 不消耗次數 (不是用戶的錯)
          if (res.status !== 401 && res.status !== 503) {
            const next: DailyUsage = {
              date: getTodayDate(),
              count: usage.count + 1,
            };
            setUsage(next);
            writeDailyUsage(next);
          }
          setError(message);
          return null;
        }

        const data = (await res.json()) as { success: boolean; steps?: string[] };
        if (!data.success || !Array.isArray(data.steps) || data.steps.length === 0) {
          const next: DailyUsage = {
            date: getTodayDate(),
            count: usage.count + 1,
          };
          setUsage(next);
          writeDailyUsage(next);
          setError("AI 回應格式異常,請重試一次");
          return null;
        }

        // 成功 → 計數 +1
        const next: DailyUsage = {
          date: getTodayDate(),
          count: usage.count + 1,
        };
        setUsage(next);
        writeDailyUsage(next);
        return data.steps;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Network error";
        setError(`網路錯誤: ${message}`);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [usage.count],
  );

  return {
    usedCount: usage.count,
    remainingCount: Math.max(0, DAILY_LIMIT - usage.count),
    dailyLimit: DAILY_LIMIT,
    isLimitReached: usage.count >= DAILY_LIMIT,
    loading,
    error,
    shred,
    resetUsage,
  };
}
