"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { parseHHmm } from "@/lib/rhythm";
import { normalizeSettings } from "@/lib/rhythmSettings";
import {
  DEFAULT_RHYTHM_SETTINGS,
  type PausedPlanEntry,
  type RhythmAnchorId,
  type RhythmProfile,
  type RhythmSettings,
  type ThemeDay,
  type ThemeDayId,
} from "@/lib/types";

const STORAGE_KEY = "taskflow:rhythm_settings:v1";
const IN_TAB_EVENT = "taskflow:rhythm_settings_change";
const PROFILE_ID = "rhythm-profile";
const CLOUD_DEBOUNCE_MS = 2000;

interface StoredRhythmPayload {
  settings: RhythmSettings;
  updatedAt: string; // "" means default / never edited locally
}

function readFromStorage(): StoredRhythmPayload {
  if (typeof window === "undefined") {
    return { settings: DEFAULT_RHYTHM_SETTINGS, updatedAt: "" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { settings: DEFAULT_RHYTHM_SETTINGS, updatedAt: "" };
    const parsed = JSON.parse(raw) as Partial<StoredRhythmPayload> & Partial<RhythmSettings>;
    if (parsed && typeof parsed === "object" && "settings" in parsed) {
      return {
        settings: normalizeSettings(parsed.settings),
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      };
    }
    return {
      settings: normalizeSettings(parsed),
      updatedAt: "",
    };
  } catch {
    return { settings: DEFAULT_RHYTHM_SETTINGS, updatedAt: "" };
  }
}

function writeToStorage(payload: StoredRhythmPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(IN_TAB_EVENT));
  } catch {
    // quota exceeded / private mode -> ignore
  }
}

function isNewer(a: string, b: string): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

// Module-level coordination so multiple mounted instances share one debounce timer & sync state
let cloudDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncedUpdatedAt = "";
const fetchedUids = new Set<string>();

async function upsertProfileToCloud(uid: string, payload: StoredRhythmPayload): Promise<void> {
  if (!supabase || !payload.updatedAt) return;
  try {
    const profile: RhythmProfile = {
      id: PROFILE_ID,
      kind: "rhythm-profile",
      settings: payload.settings,
      updatedAt: payload.updatedAt,
    };
    const { error } = await supabase.from("personal_habits").upsert({
      id: PROFILE_ID,
      owner_uid: uid,
      data: profile,
      is_archived: false,
    });
    if (error) {
      console.warn("[useRhythmSettings] cloud upsert warning:", error.message);
      return;
    }
    lastSyncedUpdatedAt = payload.updatedAt;
  } catch (err) {
    console.warn("[useRhythmSettings] cloud upsert failed:", err);
  }
}

function scheduleCloudUpsert(uid: string | undefined, payload: StoredRhythmPayload): void {
  if (!uid || !payload.updatedAt) return;
  if (cloudDebounceTimer) clearTimeout(cloudDebounceTimer);
  cloudDebounceTimer = setTimeout(() => {
    cloudDebounceTimer = null;
    void upsertProfileToCloud(uid, payload);
  }, CLOUD_DEBOUNCE_MS);
}

export interface UseRhythmSettingsReturn {
  settings: RhythmSettings;
  isHydrated: boolean;
  update: (patch: Partial<RhythmSettings>) => void;
  toggleMvd: () => void;
  toggleSlotGrid: () => void;
  setAnchorTime: (id: RhythmAnchorId, hhmm: string) => void;
  toggleAnchor: (id: RhythmAnchorId) => void;
  setThemeDays: (days: ThemeDay[]) => void;
  addThemeDay: (day: { label: string; emoji: string; weekdays: number[]; tag?: string }) => void;
  removeThemeDay: (id: ThemeDayId) => void;
  /** 設定／更新第 4 顆自訂紅線（label 自動裁切 20 字、time 需為合法 HH:mm） */
  setCustomAnchor: (anchor: { label: string; time: string; enabled: boolean }) => void;
  /** 讓整套方案進入休眠；resumeDate 為選填的自動喚醒日（YYYY-MM-DD） */
  pausePlan: (planId: string, resumeDate?: string) => void;
  /** 立即喚醒整套方案 */
  resumePlan: (planId: string) => void;
}

export function useRhythmSettings(): UseRhythmSettingsReturn {
  const { user } = useAuth();
  const uid = user?.uid;

  const [settings, setSettings] = useState<RhythmSettings>(DEFAULT_RHYTHM_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);

  // SSR-safe mount hydration
  useEffect(() => {
    const stored = readFromStorage();
    setSettings(stored.settings);
    setIsHydrated(true);
  }, []);

  // Cross-tab & in-tab sync
  useEffect(() => {
    const syncFromLocal = () => {
      setSettings(readFromStorage().settings);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) syncFromLocal();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(IN_TAB_EVENT, syncFromLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(IN_TAB_EVENT, syncFromLocal);
    };
  }, []);

  // Initial cloud pull + merge on auth, plus retry on reconnect
  useEffect(() => {
    if (!uid || !supabase) return;
    let cancelled = false;

    const syncWithCloud = async () => {
      try {
        const { data, error } = await supabase
          .from("personal_habits")
          .select("data")
          .eq("id", PROFILE_ID)
          .eq("owner_uid", uid)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.warn("[useRhythmSettings] cloud load warning:", error.message);
          return;
        }

        const local = readFromStorage();
        const cloudRaw = data?.data as Partial<RhythmProfile> | undefined;

        if (cloudRaw && cloudRaw.kind === "rhythm-profile" && cloudRaw.settings) {
          const cloudUpdatedAt = typeof cloudRaw.updatedAt === "string" ? cloudRaw.updatedAt : "";
          if (isNewer(cloudUpdatedAt, local.updatedAt)) {
            const nextPayload: StoredRhythmPayload = {
              settings: normalizeSettings(cloudRaw.settings),
              updatedAt: cloudUpdatedAt,
            };
            lastSyncedUpdatedAt = cloudUpdatedAt;
            writeToStorage(nextPayload);
            setSettings(nextPayload.settings);
          } else if (isNewer(local.updatedAt, cloudUpdatedAt)) {
            await upsertProfileToCloud(uid, local);
          } else {
            lastSyncedUpdatedAt = cloudUpdatedAt;
          }
        } else if (local.updatedAt) {
          await upsertProfileToCloud(uid, local);
        }
      } catch (err) {
        console.warn("[useRhythmSettings] cloud sync failed:", err);
      }
    };

    if (!fetchedUids.has(uid)) {
      fetchedUids.add(uid);
      void syncWithCloud();
    }

    const onOnline = () => {
      const local = readFromStorage();
      if (isNewer(local.updatedAt, lastSyncedUpdatedAt)) {
        void upsertProfileToCloud(uid, local);
      }
    };

    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [uid]);

  const commit = useCallback(
    (updater: (prev: RhythmSettings) => RhythmSettings) => {
      const current = readFromStorage().settings;
      const next = normalizeSettings(updater(current));
      const nextPayload: StoredRhythmPayload = {
        settings: next,
        updatedAt: new Date().toISOString(),
      };
      setSettings(next);
      writeToStorage(nextPayload);
      scheduleCloudUpsert(uid, nextPayload);
    },
    [uid]
  );

  const update = useCallback(
    (patch: Partial<RhythmSettings>) => {
      commit((prev) => ({ ...prev, ...patch }));
    },
    [commit]
  );

  const toggleMvd = useCallback(() => {
    commit((prev) => ({ ...prev, mvdEnabled: !prev.mvdEnabled }));
  }, [commit]);

  const toggleSlotGrid = useCallback(() => {
    commit((prev) => ({ ...prev, slotGridEnabled: !prev.slotGridEnabled }));
  }, [commit]);

  const setAnchorTime = useCallback(
    (id: RhythmAnchorId, hhmm: string) => {
      if (parseHHmm(hhmm) === null) return;
      if (id === "custom") {
        commit((prev) => {
          const base = prev.customAnchor ?? {
            label: "個人節奏紅線",
            time: prev.screensOffTime,
            enabled: false,
          };
          return { ...prev, customAnchor: { ...base, time: hhmm } };
        });
        return;
      }
      commit((prev) => {
        if (id === "wake") return { ...prev, wakeTime: hhmm };
        if (id === "offduty") return { ...prev, offDutyTime: hhmm };
        return { ...prev, screensOffTime: hhmm };
      });
    },
    [commit]
  );

  const toggleAnchor = useCallback(
    (id: RhythmAnchorId) => {
      if (id === "custom") {
        commit((prev) => {
          const base = prev.customAnchor ?? {
            label: "個人節奏紅線",
            time: prev.screensOffTime,
            enabled: false,
          };
          const nextEnabled = !base.enabled;
          return {
            ...prev,
            customAnchor: { ...base, enabled: nextEnabled },
            enabled: { ...prev.enabled, custom: nextEnabled },
          };
        });
        return;
      }
      commit((prev) => ({
        ...prev,
        enabled: { ...prev.enabled, [id]: !prev.enabled[id] },
      }));
    },
    [commit]
  );

  const setThemeDays = useCallback(
    (days: ThemeDay[]) => {
      commit((prev) => ({ ...prev, themeDays: days }));
    },
    [commit]
  );

  const addThemeDay = useCallback(
    (day: { label: string; emoji: string; weekdays: number[]; tag?: string }) => {
      const trimmedLabel = day.label.trim();
      if (!trimmedLabel) return;
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `theme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newTheme: ThemeDay = {
        id,
        label: trimmedLabel,
        emoji: day.emoji.trim(),
        weekdays: [...day.weekdays].sort((a, b) => a - b),
        ...(day.tag?.trim() ? { tag: day.tag.trim() } : {}),
      };
      commit((prev) => ({ ...prev, themeDays: [...prev.themeDays, newTheme] }));
    },
    [commit]
  );

  const removeThemeDay = useCallback(
    (id: ThemeDayId) => {
      commit((prev) => ({
        ...prev,
        themeDays: prev.themeDays.filter((t) => t.id !== id),
      }));
    },
    [commit]
  );

  // ── 第 4 顆自訂紅線 ──────────────────────────────────────────
  const setCustomAnchor = useCallback(
    (anchor: { label: string; time: string; enabled: boolean }) => {
      const label = anchor.label.trim().slice(0, 20);
      if (!label) return;
      if (parseHHmm(anchor.time) === null) return;
      commit((prev) => ({
        ...prev,
        customAnchor: { label, time: anchor.time, enabled: anchor.enabled === true },
        enabled: { ...prev.enabled, custom: anchor.enabled === true },
      }));
    },
    [commit]
  );

  // ── 方案休眠／恢復 ──────────────────────────────────────────
  const pausePlan = useCallback(
    (planId: string, resumeDate?: string) => {
      if (!planId) return;
      const validResume =
        resumeDate && /^\d{4}-\d{2}-\d{2}$/.test(resumeDate) ? resumeDate : undefined;
      commit((prev) => {
        const nextPaused: Record<string, PausedPlanEntry> = { ...(prev.pausedPlans ?? {}) };
        nextPaused[planId] = {
          pausedAt: new Date().toISOString(),
          ...(validResume ? { resumeDate: validResume } : {}),
        };
        return { ...prev, pausedPlans: nextPaused };
      });
    },
    [commit]
  );

  const resumePlan = useCallback(
    (planId: string) => {
      if (!planId) return;
      commit((prev) => {
        if (!prev.pausedPlans?.[planId]) return prev;
        const nextPaused = { ...prev.pausedPlans };
        delete nextPaused[planId];
        return { ...prev, pausedPlans: nextPaused };
      });
    },
    [commit]
  );

  return {
    settings,
    isHydrated,
    update,
    toggleMvd,
    toggleSlotGrid,
    setAnchorTime,
    toggleAnchor,
    setThemeDays,
    addThemeDay,
    removeThemeDay,
    setCustomAnchor,
    pausePlan,
    resumePlan,
  };
}
