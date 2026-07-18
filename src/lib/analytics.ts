"use client";

/**
 * analytics.ts — 事件追蹤包裝層
 *
 * 目前僅輸出 console.debug，日後串接 Amplitude / Mixpanel / PostHog 時
 * 只需在此修改實作即可。
 *
 * 命名慣例：
 *   track("event_name", { key: value })
 *   track("painted_door_clicked", { feature: "stats-dashboard" })
 */

type EventProperties = Record<string, string | number | boolean | null | undefined>;

const isDev = process.env.NODE_ENV === "development";

export function track(event: string, properties?: EventProperties): void {
  if (isDev) {
    console.debug(`[Analytics] ${event}`, properties ?? {});
  }
  // TODO: post to /api/analytics or amplitude/mixpanel/posthog
}
