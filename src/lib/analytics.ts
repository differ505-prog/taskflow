"use client";

/**
 * analytics.ts — 事件追蹤包裝層
 *
 * 設計：
 * 1. 介面穩定：`track(event, props)` 是唯一對外 API
 * 2. 實作可換：目前底層是 PostHog（lazy init），日後換 Amplitude / Mixpanel 只改此檔
 * 3. SSR 安全：posthog-js 是瀏覽器 SDK，init 延遲到 client mount 後
 * 4. 占位符容忍：key 是 placeholder 時只 console.debug，避免污染真實 dashboard
 *
 * 命名慣例：
 *   track("painted_door_clicked", { feature: "stats-dashboard" })
 *   track("feature_used", { feature: "tag-rename" })
 */

import posthog from "posthog-js";

type EventProperties = Record<string, string | number | boolean | null | undefined>;

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const isPlaceholderKey =
  POSTHOG_KEY === "" ||
  POSTHOG_KEY.startsWith("phc_placeholder") ||
  POSTHOG_KEY.includes("placeholder");

let initialized = false;

/**
 * 初始化 PostHog（client-side only）。
 * 首次呼叫時 init，後續呼叫 no-op。
 * placeholder key 時跳過 init，事件只走 console.debug。
 */
function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  if (isPlaceholderKey) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: "identified_only",
  });
}

export function track(event: string, properties?: EventProperties): void {
  ensureInit();

  if (isPlaceholderKey || typeof window === "undefined") {
    console.debug(`[Analytics:console] ${event}`, properties ?? {});
    return;
  }

  posthog.capture(event, properties);
}

/**
 * 標識用戶（登入後呼叫）。
 * 目前 AuthContext 已有 user.email，未來可在此串接。
 */
export function identify(userId: string, traits?: EventProperties): void {
  ensureInit();
  if (isPlaceholderKey || typeof window === "undefined") {
    console.debug(`[Analytics:console] identify`, { userId, traits });
    return;
  }
  posthog.identify(userId, traits);
}

/**
 * 註冊一次性屬性（例：user role、plan tier）。
 */
export function setUserProperties(properties: EventProperties): void {
  ensureInit();
  if (isPlaceholderKey || typeof window === "undefined") return;
  posthog.setPersonProperties(properties);
}
