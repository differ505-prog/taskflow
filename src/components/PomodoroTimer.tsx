"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { useZenFlowContext, usePomodoroContext } from "@/lib/ZenFlowContext";
import type { PomodoroType } from "@/lib/usePomodoro";
import { Task } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play, Pause, RotateCcw, Coffee, Target,
  X, Timer, Search,
} from "lucide-react";

interface PomodoroTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SESSIONS_BEFORE_LONG_BREAK = 4;

type TimerType = PomodoroType;

export function PomodoroTimer({ isOpen, onClose }: PomodoroTimerProps) {
  const { tasks, todayFocusMinutes } = useApp();
  const { state: zenState, play, pause } = useZenFlowContext();
  const pomodoro = usePomodoroContext();

  const {
    snapshot,
    secondsLeft,
    start,
    pause: pausePomodoro,
    resume,
    reset,
    cycleType,
    setBoundTask,
  } = pomodoro;

  const [taskSearch, setTaskSearch] = useState("");
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const taskSearchRef = useRef<HTMLInputElement>(null);
  const taskMenuRef = useRef<HTMLDivElement>(null);

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
  const selectedTask = useMemo(
    () => activeTasks.find((t) => t.id === snapshot.boundTaskId),
    [activeTasks, snapshot.boundTaskId],
  );

  // ── Click outside for task menu ────────────────────────────
  useEffect(() => {
    if (!taskMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        taskMenuRef.current &&
        !taskMenuRef.current.contains(e.target as Node)
      ) {
        setTaskMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [taskMenuOpen]);

  // ── Alarm + Notification when a session completes ─────────
  useEffect(() => {
    const unsubscribe = pomodoro.onComplete((finalSnapshot) => {
      const isFocus = finalSnapshot.type === "focus";

      // 1. Play alarm sound
      try {
        const audio = new Audio("/sounds/alarm.mp3");
        audio.volume = 0.7;
        audio.play().catch(() => {
          // Autoplay may be blocked; the system notification still fires below
        });
      } catch {
        // Audio API not available; continue with notification
      }

      // 2. System notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("VibeList 番茄鐘", {
            body: isFocus ? "專注時間結束！休息一下吧 🌿" : "休息結束,準備下一個專注 session ✨",
            icon: "/favicon.svg",
          });
        } catch {
          // Notification API unavailable on some browsers
        }
      }

      // 3. Stop focus music when focus session ends
      if (isFocus) {
        pause();
      }
    });
    return unsubscribe;
  }, [pomodoro, pause]);

  // ── Auto-play music when focus session starts ──────────────
  // (kept here, not in handleStart, so the same behavior holds whether
  //  start() is invoked from this modal or from any future entry point.)
  useEffect(() => {
    if (snapshot.phase === "running" && snapshot.type === "focus" && !zenState.isPlaying) {
      play();
    }
  }, [snapshot.phase, snapshot.type, zenState.isPlaying, play]);

  const handleStart = useCallback(() => {
    if (snapshot.phase === "paused") {
      resume();
      if (snapshot.type === "focus" && !zenState.isPlaying) play();
    } else {
      start({ type: snapshot.type, taskId: snapshot.boundTaskId });
    }
  }, [snapshot.phase, snapshot.type, snapshot.boundTaskId, start, resume, zenState.isPlaying, play]);

  const handlePause = useCallback(() => {
    pausePomodoro();
  }, [pausePomodoro]);

  const handleReset = useCallback(() => {
    reset({ type: snapshot.type });
    if (snapshot.type === "focus") pause();
  }, [reset, snapshot.type, pause]);

  if (!isOpen) return null;

  return (
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
        className="w-full max-w-sm rounded-3xl p-8 text-center space-y-5"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Type selector */}
        <div className="flex items-center justify-center gap-1 p-1 rounded-2xl" style={{ background: "var(--surface-muted)" }}>
          {[
            { value: "focus" as TimerType, label: "專注", icon: <Target className="w-4 h-4" /> },
            { value: "break" as TimerType, label: "短休息", icon: <Coffee className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => cycleType(t.value)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
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
              className="relative w-20 h-20 rounded-full overflow-hidden border"
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
              OmniSonic · Deep Focus
            </p>
          </div>
        )}

        {/* Link to task — searchable combobox */}
        <div className="relative" ref={taskMenuRef}>
          <button
            type="button"
            onClick={() => {
              setTaskMenuOpen((v) => !v);
              if (!taskMenuOpen) {
                requestAnimationFrame(() => taskSearchRef.current?.focus());
              }
            }}
            className="input text-center flex items-center justify-center gap-2 truncate"
            style={{ fontSize: 13 }}
            aria-haspopup="listbox"
            aria-expanded={taskMenuOpen}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            <span className="truncate">
              {selectedTask ? selectedTask.title : "綁定任務（點擊搜尋）"}
            </span>
            {selectedTask && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setBoundTask(undefined); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setBoundTask(undefined); } }}
                className="ml-auto p-0.5 rounded hover:bg-black/5"
                aria-label="清除綁定"
              >
                <X className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} />
              </span>
            )}
          </button>

          <AnimatePresence>
            {taskMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden shadow-lg z-10"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", maxHeight: 260 }}
              >
                <div className="p-2 sticky top-0 z-[1]" style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--border)" }}>
                  <input
                    ref={taskSearchRef}
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="搜尋任務..."
                    className="input w-full"
                    style={{ fontSize: 13, paddingTop: 6, paddingBottom: 6 }}
                    onKeyDown={(e) => { if (e.key === "Escape") setTaskMenuOpen(false); }}
                  />
                </div>
                <ul role="listbox" className="overflow-y-auto" style={{ maxHeight: 200 }}>
                  <li>
                    <button
                      type="button"
                      onClick={() => { setBoundTask(undefined); setTaskMenuOpen(false); setTaskSearch(""); }}
                      className="w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-black/5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      不綁定任務
                    </button>
                  </li>
                  {filteredTasks.length === 0 ? (
                    <li className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      找不到符合「{taskSearch}」的任務
                    </li>
                  ) : (
                    filteredTasks.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => { setBoundTask(t.id); setTaskMenuOpen(false); setTaskSearch(""); }}
                          className="w-full px-3 py-2 text-left text-[13px] truncate transition-colors hover:bg-[var(--surface-hover)]"
                          style={{ color: "var(--text-primary)" }}
                          role="option"
                          aria-selected={t.id === snapshot.boundTaskId}
                          title={t.title}
                        >
                          {t.title}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {todayFocusMinutes > 0 && (
          <p className="text-[12px] mt-2" style={{ color: "var(--text-tertiary)" }}>
            今日累計專注 {todayFocusMinutes} 分鐘
          </p>
        )}

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
    </motion.div>
  );
}