/**
 * rhythmSettings.ts — 節奏設定的純函式正規化層（不含 React / 雲端依賴）
 *
 * 抽出成獨立模組的理由：
 *   1. `useRhythmSettings.ts` 帶 `"use client"` 且 import `AuthContext.tsx`（含 JSX），
 *      vitest 的 jsx transform 未啟用時無法 import → 純函式必須可獨立測試。
 *   2. 雲端 / localStorage / Agent API 三條資料來源共用同一套正規化，
 *      避免「某條路徑漏驗欄位」造成同步失步。
 */
import { parseHHmm } from "@/lib/rhythm";
import {
  DEFAULT_RHYTHM_SETTINGS,
  type CustomRhythmAnchor,
  type PausedPlanEntry,
  type RhythmSettings,
} from "@/lib/types";

/** 正規化第 4 顆自訂紅線：label 裁切 20 字、time 需為合法 HH:mm、enabled 需為 boolean */
export function normalizeCustomAnchor(raw: unknown): CustomRhythmAnchor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Partial<CustomRhythmAnchor>;
  const label = typeof obj.label === "string" ? obj.label.trim().slice(0, 20) : "";
  const time =
    typeof obj.time === "string" && parseHHmm(obj.time) !== null ? obj.time : undefined;
  if (!label || !time) return undefined;
  return { label, time, enabled: obj.enabled === true };
}

/** 正規化方案休眠紀錄：純物件 Record、resumeDate 需為 YYYY-MM-DD */
export function normalizePausedPlans(
  raw: unknown
): Record<string, PausedPlanEntry> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, PausedPlanEntry> = {};
  for (const [planId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!planId || !value || typeof value !== "object") continue;
    const entry = value as Partial<PausedPlanEntry>;
    const pausedAt =
      typeof entry.pausedAt === "string" && entry.pausedAt
        ? entry.pausedAt
        : new Date().toISOString();
    const resumeDate =
      typeof entry.resumeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.resumeDate)
        ? entry.resumeDate
        : undefined;
    out[planId] = { pausedAt, ...(resumeDate ? { resumeDate } : {}) };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * 把外部（localStorage / 雲端 / Agent API）傳入的設定資料正規化。
 *
 * 關鍵對齊：`enabled.custom` 以 `customAnchor.enabled` 為單一事實來源。
 * 雲端可能只有 `customAnchor.enabled = true` 而漏了 `enabled.custom`，
 * 若不對齊，開關會顯示為關閉但紅線實際上仍在觸發。
 */
export function normalizeSettings(raw: unknown): RhythmSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_RHYTHM_SETTINGS;
  const obj = raw as Partial<RhythmSettings>;
  const customAnchor = normalizeCustomAnchor(obj.customAnchor);
  const pausedPlans = normalizePausedPlans(obj.pausedPlans);
  return {
    wakeTime:
      typeof obj.wakeTime === "string" && parseHHmm(obj.wakeTime) !== null
        ? obj.wakeTime
        : DEFAULT_RHYTHM_SETTINGS.wakeTime,
    offDutyTime:
      typeof obj.offDutyTime === "string" && parseHHmm(obj.offDutyTime) !== null
        ? obj.offDutyTime
        : DEFAULT_RHYTHM_SETTINGS.offDutyTime,
    screensOffTime:
      typeof obj.screensOffTime === "string" && parseHHmm(obj.screensOffTime) !== null
        ? obj.screensOffTime
        : DEFAULT_RHYTHM_SETTINGS.screensOffTime,
    enabled: {
      wake: obj.enabled?.wake ?? DEFAULT_RHYTHM_SETTINGS.enabled.wake,
      offduty: obj.enabled?.offduty ?? DEFAULT_RHYTHM_SETTINGS.enabled.offduty,
      screensoff: obj.enabled?.screensoff ?? DEFAULT_RHYTHM_SETTINGS.enabled.screensoff,
      custom: customAnchor ? customAnchor.enabled : (obj.enabled?.custom ?? false),
    },
    mvdEnabled: typeof obj.mvdEnabled === "boolean" ? obj.mvdEnabled : false,
    slotGridEnabled:
      typeof obj.slotGridEnabled === "boolean"
        ? obj.slotGridEnabled
        : DEFAULT_RHYTHM_SETTINGS.slotGridEnabled,
    themeDays: Array.isArray(obj.themeDays) ? obj.themeDays : [],
    ...(customAnchor ? { customAnchor } : {}),
    ...(pausedPlans ? { pausedPlans } : {}),
  };
}
