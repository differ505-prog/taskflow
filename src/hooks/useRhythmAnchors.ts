"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRhythmSettings } from "@/hooks/useRhythmSettings";
import { anchorCopy, getActiveAnchor } from "@/lib/rhythm";

const ANCHOR_LOG_KEY = "taskflow:rhythm_anchor_log:v1";

type AnchorLog = Record<string, boolean>;

function loadAnchorLog(): AnchorLog {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(ANCHOR_LOG_KEY) || "{}") as AnchorLog;
  } catch {
    return {};
  }
}

function saveAnchorLog(log: AnchorLog): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANCHOR_LOG_KEY, JSON.stringify(log));
  } catch {
    // quota exceeded / private mode -> ignore
  }
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useRhythmAnchors(): void {
  const { settings, isHydrated } = useRhythmSettings();
  const logRef = useRef<AnchorLog>({});

  useEffect(() => {
    logRef.current = loadAnchorLog();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const tick = () => {
      const now = new Date();
      const anchorId = getActiveAnchor(now, settings);
      if (!anchorId) return;

      const dateStr = localDateString(now);
      const logKey = `${anchorId}:${dateStr}`;
      if (logRef.current[logKey]) return;

      logRef.current[logKey] = true;
      saveAnchorLog(logRef.current);

      const copy = anchorCopy(anchorId);
      toast(copy.title, {
        duration: 6000,
        id: `rhythm-${anchorId}-${dateStr}`,
        description: copy.body,
      });
    };

    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [isHydrated, settings]);
}
