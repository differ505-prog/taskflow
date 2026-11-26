import { describe, it, expect } from "vitest";
import { normalizeSettings } from "@/lib/rhythmSettings";
import { DEFAULT_RHYTHM_SETTINGS, type RhythmSettings } from "@/lib/types";

describe("normalizeSettings — 雲端 / localStorage 資料正規化", () => {
  it("非物件輸入 → 回傳 DEFAULT_RHYTHM_SETTINGS", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_RHYTHM_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_RHYTHM_SETTINGS);
    expect(normalizeSettings("abc")).toEqual(DEFAULT_RHYTHM_SETTINGS);
    expect(normalizeSettings(42)).toEqual(DEFAULT_RHYTHM_SETTINGS);
  });

  it("雲端有 customAnchor.enabled=true 但 enabled.custom 未設定 → normalize 後 enabled.custom === true", () => {
    const settings = normalizeSettings({
      customAnchor: { label: "Highball 停杯紅線", time: "20:00", enabled: true },
    });
    expect(settings.enabled.custom).toBe(true);
    expect(settings.customAnchor?.label).toBe("Highball 停杯紅線");
    expect(settings.customAnchor?.time).toBe("20:00");
  });

  it("雲端有 customAnchor.enabled=false 但 enabled.custom=true → 以 customAnchor 為準（單一事實來源）", () => {
    const settings = normalizeSettings({
      enabled: { ...DEFAULT_RHYTHM_SETTINGS.enabled, custom: true },
      customAnchor: { label: "Highball 停杯紅線", time: "20:00", enabled: false },
    });
    expect(settings.enabled.custom).toBe(false);
  });

  it("沒有 customAnchor 時，enabled.custom 沿用傳入值（預設 false）", () => {
    const s1 = normalizeSettings({ enabled: { ...DEFAULT_RHYTHM_SETTINGS.enabled, custom: true } });
    expect(s1.enabled.custom).toBe(true);
    expect(s1.customAnchor).toBeUndefined();

    const s2 = normalizeSettings({});
    expect(s2.enabled.custom).toBe(false);
  });

  it("customAnchor 的 label 空字串 → 整段丟棄，不產生半殘資料", () => {
    const settings = normalizeSettings({
      customAnchor: { label: "   ", time: "20:00", enabled: true },
    });
    expect(settings.customAnchor).toBeUndefined();
    expect(settings.enabled.custom).toBe(false);
  });

  it("customAnchor 的 time 非法 → 整段丟棄", () => {
    const settings = normalizeSettings({
      customAnchor: { label: "停杯紅線", time: "25:99", enabled: true },
    });
    expect(settings.customAnchor).toBeUndefined();
    expect(settings.enabled.custom).toBe(false);
  });

  it("customAnchor.label 超過 20 字 → 自動裁切", () => {
    const settings = normalizeSettings({
      customAnchor: { label: "超級無敵長的紅線名稱超過二十個字囉真的真的", time: "20:00", enabled: true },
    });
    expect(settings.customAnchor?.label.length).toBe(20);
  });

  it("pausedPlans 為非物件（陣列 / 純字串）→ 忽略", () => {
    expect(normalizeSettings({ pausedPlans: [] }).pausedPlans).toBeUndefined();
    expect(normalizeSettings({ pausedPlans: "nope" }).pausedPlans).toBeUndefined();
    expect(normalizeSettings({ pausedPlans: 123 }).pausedPlans).toBeUndefined();
  });

  it("pausedPlans 保留合法紀錄，resumeDate 格式非 YYYY-MM-DD 則剔除", () => {
    const settings = normalizeSettings({
      pausedPlans: {
        "plan-3.1": { pausedAt: "2026-11-26T10:00:00.000Z", resumeDate: "2027-01-01" },
        "plan-x": { pausedAt: "2026-11-26T10:00:00.000Z", resumeDate: "not-a-date" },
      },
    });
    expect(settings.pausedPlans?.["plan-3.1"]).toEqual({
      pausedAt: "2026-11-26T10:00:00.000Z",
      resumeDate: "2027-01-01",
    });
    expect(settings.pausedPlans?.["plan-x"]).toEqual({
      pausedAt: "2026-11-26T10:00:00.000Z",
    });
  });

  it("空 pausedPlans 物件 → 不寫入欄位（保持 undefined，避免污染雲端資料）", () => {
    expect(normalizeSettings({ pausedPlans: {} }).pausedPlans).toBeUndefined();
  });

  it("themeDays 非陣列 → 回傳空陣列", () => {
    const settings = normalizeSettings({ themeDays: "nope" });
    expect(settings.themeDays).toEqual([]);
  });

  it("非法時間字串 → 回退到預設值", () => {
    const settings = normalizeSettings({
      wakeTime: "99:99",
      offDutyTime: "abc",
      screensOffTime: "22:15",
    });
    expect(settings.wakeTime).toBe(DEFAULT_RHYTHM_SETTINGS.wakeTime);
    expect(settings.offDutyTime).toBe(DEFAULT_RHYTHM_SETTINGS.offDutyTime);
    expect(settings.screensOffTime).toBe("22:15");
  });

  it("三顆內建錨點的 enabled 不受 customAnchor 影響", () => {
    const settings: RhythmSettings = normalizeSettings({
      enabled: { wake: false, offduty: true, screensoff: false },
      customAnchor: { label: "紅線", time: "20:00", enabled: true },
    });
    expect(settings.enabled.wake).toBe(false);
    expect(settings.enabled.offduty).toBe(true);
    expect(settings.enabled.screensoff).toBe(false);
    expect(settings.enabled.custom).toBe(true);
  });
});
