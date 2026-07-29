"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/AppContext";
import { useZenFlowContext, useFlowTimerContext } from "@/lib/ZenFlowContext";
import type { FlowTimerType } from "@/lib/usePomodoro";
import { Task } from "@/lib/types";
import { motion } from "framer-motion";
import {
  Play, Pause, RotateCcw, Coffee, Target,
  X, Search,
} from "lucide-react";
import { dispatchPwaInstallPrompt } from "@/components/PwaPrompts";

interface FlowTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SESSIONS_BEFORE_LONG_BREAK = 4;

type TimerType = FlowTimerType;

export function FlowTimerModal({ isOpen, onClose }: FlowTimerModalProps) {
  const { tasks, todayFocusMinutes } = useApp();
  const { state: zenState } = useZenFlowContext();
  const flowTimer = useFlowTimerContext();

  const {
    snapshot,
    secondsLeft,
    start,
    pause: pauseFlowTimer,
    resume,
    reset,
    cycleType,
    setBoundTask,
  } = flowTimer;

  const [taskSearch, setTaskSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const taskSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const totalSeconds = Math.floor(snapshot.totalMs / 1000);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;

  const activeTasks = tasks.filter((t) => !t.isArchived && t.status !== "done");
  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return activeTasks.slice(0, 50);
    return activeTasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [activeTasks, taskSearch]);

  // Alarm + Notification when a session completes
  useEffect(() => {
    const unsubscribe = flowTimer.onComplete((finalSnapshot) => {
      const isFocus = finalSnapshot.type === "focus";
      try {
        const audio = new Audio("/sounds/alarm.mp3");
        audio.volume = 0.7;
        audio.play().catch(() => {});
      } catch {}
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("VibeList 心流計時器", {
            body: isFocus ? "專注時間結束！休息一下吧 🌿" : "休息結束,準備下一個專注 session ✨",
            icon: "/favicon.svg",
          });
        } catch {}
      }
      // 條件 B：首次番茄鐘完成 → 觸發 PWA 安裝提示
      dispatchPwaInstallPrompt();
    });
    return unsubscribe;
  }, [flowTimer]);

  // Auto-play music when focus session starts
  useEffect(() => {
    // 音樂控制已從計時器拆分，用戶需手動點擊音樂按鈕
  }, [snapshot.phase, snapshot.type, zenState.isPlaying]);

  const handleStart = useCallback(() => {
    if (snapshot.phase === "paused") {
      resume();
    } else {
      start({ type: snapshot.type, taskId: snapshot.boundTaskId });
    }
  }, [snapshot.phase, snapshot.type, snapshot.boundTaskId, start, resume]);

  const handlePause = useCallback(() => {
    pauseFlowTimer();
  }, [pauseFlowTimer]);

  const handleReset = useCallback(() => {
    reset({ type: snapshot.type });
  }, [reset, snapshot.type]);

  if (!isOpen) return null;
  if (!mounted) return null;

  // ── Portal: render the entire modal to body ──────────────────────────────
  // This escapes ALL overflow/stacking-context ancestors — critical so that
  // TaskMenuPortal (also portal'd to body) positions correctly without
  // being clipped by any overflow:hidden scroll container.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative flex items-stretch overflow-hidden"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)", borderRadius: "1.5rem" }}
      >
        {/* Left: timer content */}
        <div className="flex-1 flex flex-col items-center p-8 text-center space-y-5 min-w-0">
          {/* Type selector */}
          <div className="flex items-center justify-center gap-1 p-1 rounded-2xl self-stretch" style={{ background: "var(--surface-muted)" }}>
            {[
              { value: "focus" as TimerType, label: "專注", icon: <Target className="w-4 h-4" /> },
              { value: "break" as TimerType, label: "短休息", icon: <Coffee className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => cycleType(t.value)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
                style={
                  snapshot.type === t.value
                    ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)", color: "var(--text-primary)" }
                    : { color: "var(--text-tertiary)" }
                }
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Session counter */}
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: SESSIONS_BEFORE_LONG_BREAK }).map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                style={{
                  background: i < (snapshot.completedSessions % SESSIONS_BEFORE_LONG_BREAK) ? "var(--brand)" : "var(--surface-hover)",
                  transform: i < (snapshot.completedSessions % SESSIONS_BEFORE_LONG_BREAK) ? "scale(1.2)" : "scale(1)",
                }}
              />
            ))}
            <span className="text-[11px] ml-1" style={{ color: "var(--text-tertiary)" }}>
              {snapshot.completedSessions} 個專注 session
            </span>
          </div>

          {/* Timer ring */}
          <div className="relative inline-flex items-center justify-center">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle
                cx="100" cy="100" r="88"
                fill="none"
                stroke="var(--surface-muted)"
                strokeWidth="8"
              />
              <circle
                cx="100" cy="100" r="88"
                fill="none"
                stroke={snapshot.type === "focus" ? "var(--brand)" : "var(--status-success)"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 88}`}
                strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress)}`}
                transform="rotate(-90 100 100)"
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              <span className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                {snapshot.type === "focus"
                  ? snapshot.phase === "running" ? "專注中"
                  : snapshot.phase === "paused" ? "已暫停"
                  : "準備開始"
                  : "休息時間"}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleReset}
              className="p-3 rounded-2xl transition-all hover:bg-black/5"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="重置計時器"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={snapshot.phase === "running" ? handlePause : handleStart}
              className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
              style={{
                background: snapshot.type === "focus" ? "var(--brand)" : "var(--status-success)",
                boxShadow: snapshot.type === "focus"
                  ? "0 4px 20px rgba(79,106,245,0.4)"
                  : "0 4px 20px rgba(52,199,89,0.4)",
              }}
              aria-label={snapshot.phase === "running" ? "暫停" : "開始"}
            >
              {snapshot.phase === "running" ? (
                <Pause className="w-7 h-7" />
              ) : (
                <Play className="w-7 h-7 ml-0.5" />
              )}
            </button>
            <div className="w-11" />
          </div>

          {/* OmniSonic Deep Focus embed button */}
          {snapshot.type === "focus" && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative w-20 h-20 rounded-full overflow-hidden border cursor-pointer transition-all hover:scale-105 active:scale-95"
                style={{ borderColor: "rgba(192,38,211,0.3)", boxShadow: "0 0 24px rgba(192,38,211,0.25)" }}
              >
                <iframe
                  src={`${process.env.NEXT_PUBLIC_OMNISONIC_URL ?? ""}/embed/button`}
                  title="OmniSonic Deep Focus Button"
                  className="w-full h-full border-0"
                  allow="autoplay"
                />
              </div>
              <p className="text-[10px] tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
                OmniSonic · Deep Focus · Free 25 分鐘
              </p>
            </div>
          )}

          {/* Today focus stat */}
          {todayFocusMinutes > 0 && (
            <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              今日累計專注 {todayFocusMinutes} 分鐘
            </p>
          )}
        </div>

        {/* Right: task selection panel */}
        <TaskMenuInline
          filteredTasks={filteredTasks}
          taskSearch={taskSearch}
          setTaskSearch={setTaskSearch}
          onSelect={(id) => { setBoundTask(id); setTaskSearch(""); }}
          onClear={() => { setBoundTask(undefined); setTaskSearch(""); }}
          taskSearchRef={taskSearchRef}
          selectedTaskId={snapshot.boundTaskId}
        />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-black/5 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="關閉計時器"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ── Task menu — right side panel ────────────────────────────────────────────
interface TaskMenuPortalProps {
  filteredTasks: Task[];
  taskSearch: string;
  setTaskSearch: (v: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  taskSearchRef: React.RefObject<HTMLInputElement | null>;
  selectedTaskId?: string;
}

function TaskMenuInline({
  filteredTasks,
  taskSearch,
  setTaskSearch,
  onSelect,
  onClear,
  taskSearchRef,
  selectedTaskId,
}: TaskMenuPortalProps) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: 240,
        borderLeft: "1px solid var(--border)",
        background: "var(--surface-elevated)",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center gap-2 p-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
        <input
          ref={taskSearchRef}
          type="text"
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
          placeholder="搜尋任務..."
          className="input flex-1 min-w-0"
          style={{ fontSize: 13, paddingTop: 4, paddingBottom: 4 }}
        />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <button
          type="button"
          onClick={onClear}
          className="w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-black/5"
          style={{ color: "var(--text-tertiary)" }}
        >
          不綁定任務
        </button>
        {filteredTasks.length === 0 && taskSearch ? (
          <p className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            找不到「{taskSearch}」
          </p>
        ) : (
          filteredTasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="w-full px-3 py-2 text-left text-[13px] truncate transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: t.id === selectedTaskId ? "var(--brand)" : "var(--text-primary)", fontWeight: t.id === selectedTaskId ? 500 : 400 }}
              title={t.title}
            >
              {t.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
