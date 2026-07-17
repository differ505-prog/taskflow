"use client";

/**
 * useWebhook — Outbound Webhook Hook
 *
 * 用戶在 Settings 設定「自動化整合 URL」後,
 * 任務變動（新增/更新/刪除）會 debounce 觸發 POST 帶 payload,
 * 對接 Zapier / Make / n8n / 自家後端等服務。
 *
 * 資安原則（§8）：
 * - URL 存 localStorage（純前端,不經後端代理）
 * - HTTPS 強烈建議（payload 含任務資料）
 * - 失敗靜默吞掉,不污染主流程 UX
 *
 * 資料流：
 * SettingsPage 設定 URL → useWebhook 暴露到 AppContext → 任務變動時 trigger()
 */

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "taskflow_webhook_url";

export interface WebhookPayload {
  /** ISO timestamp */
  timestamp: string;
  /** 事件類型 */
  event: "task.created" | "task.updated" | "task.deleted" | "habit.changed" | "list.changed" | "batch";
  /** 觸發來源（user id 或 "anonymous"） */
  source: string;
  /** 變動資料（節錄,避免太大 payload 拖累 Zapier） */
  data: unknown;
}

/**
 * 讀取 user 設定的 webhook URL
 */
export function getWebhookUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * 設定 webhook URL（傳空字串或 null 表示清除）
 */
export function setWebhookUrl(url: string | null): void {
  if (typeof window === "undefined") return;
  if (!url || !url.trim()) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, url.trim());
}

/**
 * 核心觸發 function：debounced outbound POST
 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

export function triggerWebhook(payload: WebhookPayload): void {
  const url = getWebhookUrl();
  if (!url) return; // 未設定 = 不做事

  // debounce 避免連續變動 spam Zapier
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void (async () => {
      try {
        await fetch(url, {
          method: "POST",
          mode: "no-cors", // §8:瀏覽器預設無法讀 user 任意 endpoint CORS,改用 no-cors fire-and-forget
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } catch (err) {
        // §8:失敗靜默,不要污染主流程 UX
        if (process.env.NODE_ENV === "development") {
          console.warn("[webhook] POST failed (silent):", err);
        }
      }
    })();
  }, DEBOUNCE_MS);
}

/**
 * React hook：給 UI 使用,訂閱設定變化
 */
export function useWebhookSettings() {
  const [url, setUrlState] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    setUrlState(getWebhookUrl());
    mountedRef.current = true;

    // 跨分頁同步
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUrlState(getWebhookUrl());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((newUrl: string | null) => {
    setWebhookUrl(newUrl);
    setUrlState(getWebhookUrl());
  }, []);

  const clear = useCallback(() => {
    setWebhookUrl(null);
    setUrlState(null);
  }, []);

  return { url, update, clear };
}