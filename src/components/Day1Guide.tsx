"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Zap, Smartphone, CheckCircle2, X, ArrowRight } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import { hasCompletedOnboarding } from "@/components/Onboarding";

/**
 * Day 1 Guide — 完成 Onboarding 後的首次引導
 *
 * 觸發條件：
 *  - Onboarding 已完成（hasCompletedOnboarding === true）
 *  - Day 1 Guide 尚未完成（localStorage flag）
 *  - 使用者已登入
 *
 * 三步驟：
 *  1. 新增你的第一個任務 → 點任意地方跳到收件箱
 *  2. 加入主畫面 → 喚醒 PWA 安裝提示
 *  3. 開始專注 → 進入禪模式
 *
 * 設計原則：
 *  - 不阻擋操作（fixed 但 non-modal，點擊外部可繼續工作）
 *  - 進度 localStorage 持久化，刷新頁面不丟失
 *  - 完成後自動消失，不打擾第二次
 */
const DAY1_GUIDE_KEY = "taskflow_day1_guide_done";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  action: () => void;
  completed: boolean;
}

export function Day1Guide() {
  const { user, loading } = useAuth();
  const { isAppReady, tasksInitialized } = useApp();
  const [visible, setVisible] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // ── 初始化 ────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;
    if (dismissed) return;
    if (!isAppReady || !tasksInitialized) return;

    // 檢查是否已完成 Onboarding
    if (!hasCompletedOnboarding(user.uid)) return;

    // 檢查 Day 1 Guide 是否已完成
    const guideKey = `${DAY1_GUIDE_KEY}_${user.uid}`;
    if (typeof window !== "undefined" && localStorage.getItem(guideKey) === "1") return;

    setInitialized(true);
    setVisible(true);

    // 讀取已完成的步驟
    const stepsKey = `${DAY1_GUIDE_KEY}_steps_${user.uid}`;
    try {
      const raw = localStorage.getItem(stepsKey);
      if (raw) setCompletedSteps(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, [loading, user?.uid, isAppReady, tasksInitialized, dismissed]);

  // ── 步驟完成 ────────────────────────────────────────────
  const markStepDone = useCallback(
    (stepId: string) => {
      if (!user?.uid) return;
      const next = new Set(completedSteps);
      next.add(stepId);
      setCompletedSteps(next);

      // 持久化
      const stepsKey = `${DAY1_GUIDE_KEY}_steps_${user.uid}`;
      try { localStorage.setItem(stepsKey, JSON.stringify([...next])); } catch {}

      // 三步全完成 → 標記 Guide 完成
      if (next.size >= 3) {
        const guideKey = `${DAY1_GUIDE_KEY}_${user.uid}`;
        try { localStorage.setItem(guideKey, "1"); } catch {}
        setTimeout(() => setVisible(false), 600);
      }
    },
    [completedSteps, user?.uid]
  );

  // ── 定義步驟 ────────────────────────────────────────────
  const steps: Step[] = [
    {
      id: "add-task",
      icon: <Plus className="w-4 h-4" />,
      title: "新增第一個任務",
      description: "把腦中想到的事倒進收集箱，騰出專注力。",
      actionLabel: "去收集箱",
      action: () => {
        markStepDone("add-task");
        window.location.href = "/?board=1";
      },
      completed: completedSteps.has("add-task"),
    },
    {
      id: "install-pwa",
      icon: <Smartphone className="w-4 h-4" />,
      title: "加入主畫面",
      description: "像 App 一樣開，啟動更快，離線也能用。",
      actionLabel: "查看引導",
      action: () => {
        markStepDone("install-pwa");
        // 喚醒 PwaPrompts 系統
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("taskflow:pwa-install-prompt"));
        }
      },
      completed: completedSteps.has("install-pwa"),
    },
    {
      id: "zen-mode",
      icon: <Zap className="w-4 h-4" />,
      title: "試一次禪模式",
      description: "把任務排到今天，然後進去體驗心流。",
      actionLabel: "開始專注",
      action: () => {
        markStepDone("zen-mode");
        window.location.href = "/zen";
      },
      completed: completedSteps.has("zen-mode"),
    },
  ];

  const allDone = completedSteps.size >= 3;

  if (!initialized) return null;

  return (
    <AnimatePresence>
      {visible && !allDone && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-40"
          role="complementary"
          aria-label="Day 1 新手引導"
        >
          <div className="card p-4 shadow-lg">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Day 1 新手指南
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  完成以下三件事，上手更快
                </p>
              </div>
              <button
                onClick={() => {
                  setDismissed(true);
                  setVisible(false);
                }}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors"
                aria-label="關閉新手引導"
              >
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-2 mb-3">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={step.action}
                  disabled={step.completed}
                  className="flex items-center gap-3 w-full p-2.5 rounded-xl text-left transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-default"
                  style={{
                    background: step.completed
                      ? "rgba(52, 199, 89, 0.08)"
                      : "var(--surface-muted)",
                  }}
                  aria-label={`${step.completed ? "已完成" : ""}${step.title}：${step.description}`}
                >
                  {/* Status icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: step.completed
                        ? "rgba(52, 199, 89, 0.15)"
                        : "var(--brand-tint)",
                      color: step.completed ? "#34C759" : "var(--brand)",
                    }}
                    aria-hidden="true"
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      step.icon
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12px] font-medium leading-snug"
                      style={{
                        color: step.completed
                          ? "var(--text-tertiary)"
                          : "var(--text-primary)",
                        textDecoration: step.completed ? "line-through" : "none",
                      }}
                    >
                      {step.title}
                    </p>
                    {!step.completed && (
                      <p
                        className="text-[11px] leading-tight mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {step.description}
                      </p>
                    )}
                  </div>

                  {/* Action hint */}
                  {!step.completed && (
                    <ArrowRight
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: "var(--text-tertiary)" }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Progress bar */}
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: "var(--surface-muted)" }}
              role="progressbar"
              aria-valuenow={completedSteps.size}
              aria-valuemin={0}
              aria-valuemax={3}
              aria-label={`新手引導進度：${completedSteps.size} / 3`}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--brand)" }}
                initial={{ width: 0 }}
                animate={{ width: `${(completedSteps.size / 3) * 100}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
