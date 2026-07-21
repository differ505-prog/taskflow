"use client";

import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, CheckCircle2, Flame, Trophy,
  TrendingUp, Calendar, Star, Zap,
  Lock, ArrowUpRight, Heart
} from "lucide-react";
import { Task } from "@/lib/types";
import { getTasks } from "@/lib/storage";
import { useAuth } from "@/lib/AuthContext";

function useTaskStats() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = getTasks();
    setTasks(stored);
    setIsLoaded(true);
  }, []);

  return { tasks, isLoaded };
}

// 計算連續完成天數（streak）
function calcStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const sorted = [...new Set(completedDates)].sort().reverse();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // 必須今天或昨天有完成才視為有效 streak
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 計算每週完成數
function calcWeeklyDone(tasks: Task[]): { thisWeek: number; lastWeek: number; bestDay: { date: string; count: number } } {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const dayCount: Record<string, number> = {};

  tasks.forEach((t) => {
    if (t.status === "done" && t.completedAt) {
      const d = t.completedAt.split("T")[0];
      dayCount[d] = (dayCount[d] || 0) + 1;
    }
  });

  let thisWeek = 0;
  let lastWeek = 0;
  let bestDay = { date: "", count: 0 };

  Object.entries(dayCount).forEach(([date, count]) => {
    const d = new Date(date);
    if (d >= startOfThisWeek) thisWeek += count;
    else if (d >= startOfLastWeek) lastWeek += count;

    if (count > bestDay.count) bestDay = { date, count };
  });

  return { thisWeek, lastWeek, bestDay };
}

// 里程碑訊息
const MILESTONES = [
  { threshold: 1, emoji: "🌱", message: "好的開始！完成第一個任務" },
  { threshold: 5, emoji: "⭐", message: "5 個任務已被消滅" },
  { threshold: 10, emoji: "🎯", message: "雙位數達成！你是認真的" },
  { threshold: 25, emoji: "🔥", message: "25 個任務完成，節奏正在形成" },
  { threshold: 50, emoji: "🏆", message: "50 個成就解鎖！真正的行動者" },
  { threshold: 100, emoji: "👑", message: "100 個任務！大師級執行力" },
];

function getMilestoneMessage(doneCount: number) {
  const reached = MILESTONES.filter((m) => doneCount >= m.threshold);
  if (reached.length === 0) return null;
  return reached[reached.length - 1];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().split("T")[0]) return "今天";
  if (dateStr === yesterday.toISOString().split("T")[0]) return "昨天";

  return `${d.getMonth() + 1}/${d.getDate()} ${["日", "一", "二", "三", "四", "五", "六"][d.getDay()]}`;
}

export default function StatsClient() {
  const { isAdmin, isPro, isBeta, isFree } = useAuth();
  const { tasks, isLoaded } = useTaskStats();
  const isLocked = isFree;

  const stats = useMemo(() => {
    if (!isLoaded) return null;

    const done = tasks.filter((t) => t.status === "done");
    const completedDates = done.map((t) => t.completedAt?.split("T")[0]).filter(Boolean) as string[];
    const streak = calcStreak(completedDates);
    const weekly = calcWeeklyDone(tasks);
    const doneCount = done.length;
    const milestone = getMilestoneMessage(doneCount);

    const thisWeekPct = weekly.lastWeek > 0
      ? Math.round(((weekly.thisWeek - weekly.lastWeek) / weekly.lastWeek) * 100)
      : weekly.thisWeek > 0 ? 100 : 0;

    return { doneCount, streak, weekly, milestone, thisWeekPct };
  }, [tasks, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" role="status" aria-label="載入中" />
      </div>
    );
  }

  // Free 用戶鎖定畫面（但給一個免費預覽）
  if (isLocked) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 glass">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 h-16">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
              </div>
              <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">多巴胺金庫</h1>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 免費預覽：只展示 streak 和簡單成就 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card px-8 py-8 text-center"
            role="region"
            aria-label="多巴胺金庫預覽"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "rgba(245, 158, 11, 0.12)" }}>
              <Flame className="w-7 h-7" style={{ color: "#F59E0B" }} aria-hidden="true" />
            </div>
            <h2 className="text-[18px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              追蹤你的多巴胺足跡
            </h2>
            <p className="text-[14px] mb-6" style={{ color: "var(--text-secondary)" }}>
              完成任務不是為了消除罪惡感，
              <br />
              而是為了大腦獲得獎賞。
            </p>

            {stats && stats.doneCount > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-4" style={{ background: "var(--brand-tint)" }}>
                <span className="text-[24px]">🌱</span>
                <div className="text-left">
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    你已完成 {stats.doneCount} 個任務
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {stats.streak > 1 ? `🔥 連續 ${stats.streak} 天` : "今天開始你的旅程"}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl p-5" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
              <p className="text-[13px] font-medium mb-3" style={{ color: "var(--text-primary)" }}>
                解鎖完整金庫
              </p>
              <ul className="text-[13px] text-left space-y-2 mb-5" style={{ color: "var(--text-secondary)" }}>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 每週 vs 上週對比</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 連續完成天數</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 成就里程碑</li>
              </ul>
              <button
                disabled
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium opacity-60 cursor-not-allowed"
                style={{ background: "rgba(245, 158, 11, 0.12)", color: "#F59E0B" }}
                aria-label="升級 PRO（敬請期待）"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                升級 PRO 解鎖
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // PRO / Beta / Admin 完整金庫
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">多巴胺金庫</h1>
            {!isFree && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: isPro ? "rgba(245, 158, 11, 0.12)" : "var(--surface-muted)",
                  color: isPro ? "#F59E0B" : "var(--text-tertiary)",
                }}
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                {isPro ? "PRO" : isAdmin ? "Admin" : "Beta"}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* 成就里程碑卡片（最強正向激勵） */}
        {stats && stats.milestone && (
          <motion.div
            className="rounded-2xl px-6 py-5 text-center"
            style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(59, 130, 246, 0.05))", border: "1px solid rgba(245, 158, 11, 0.2)" }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            role="status"
            aria-label={`達成里程碑：${stats.milestone.message}`}
          >
            <p className="text-[40px] mb-2">{stats.milestone.emoji}</p>
            <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {stats.milestone.message}
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              {stats.doneCount} 個任務已被你消滅
            </p>
          </motion.div>
        )}

        {/* 核心快樂指標 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* 連續天數 */}
          <motion.div
            className="card px-5 py-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                專注火種
              </span>
              <Flame className="w-4 h-4" style={{ color: stats?.streak && stats.streak >= 3 ? "#F97316" : "var(--text-tertiary)" }} aria-hidden="true" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none" style={{ color: "var(--text-primary)" }}>
                {stats?.streak ?? 0}
              </span>
              <span className="text-[14px] pb-1" style={{ color: "var(--text-secondary)" }}>天</span>
            </div>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
              {stats?.streak && stats.streak >= 3
                ? `🔥 保持燃燒！`
                : stats?.streak === 1
                ? "今天開始你的旅程"
                : "連續完成任務來累積"}
            </p>
          </motion.div>

          {/* 本週戰績 */}
          <motion.div
            className="card px-5 py-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                本週完成
              </span>
              <Calendar className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none" style={{ color: "var(--text-primary)" }}>
                {stats?.weekly.thisWeek ?? 0}
              </span>
              <span className="text-[14px] pb-1" style={{ color: "var(--text-secondary)" }}>個</span>
            </div>
            {stats && stats.thisWeekPct !== 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" style={{ color: stats.thisWeekPct > 0 ? "var(--status-success)" : "var(--status-danger)" }} aria-hidden="true" />
                <span className="text-[12px]" style={{ color: stats.thisWeekPct > 0 ? "var(--status-success)" : "var(--status-danger)" }}>
                  {Math.abs(stats.thisWeekPct)}% {stats.thisWeekPct > 0 ? "vs 上週" : "vs 上週"}
                </span>
              </div>
            )}
          </motion.div>

          {/* 最佳日 */}
          <motion.div
            className="card px-5 py-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                最佳單日
              </span>
              <Trophy className="w-4 h-4" style={{ color: "#F59E0B" }} aria-hidden="true" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none" style={{ color: "var(--text-primary)" }}>
                {stats?.weekly.bestDay.count ?? 0}
              </span>
              <span className="text-[14px] pb-1" style={{ color: "var(--text-secondary)" }}>個</span>
            </div>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
              {stats?.weekly.bestDay.date ? formatDate(stats.weekly.bestDay.date) : "還沒有記錄"}
            </p>
          </motion.div>
        </div>

        {/* 本週回顧 / 上週對比 */}
        {stats && stats.weekly.lastWeek > 0 && (
          <motion.div
            className="card px-5 py-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <p className="text-[12px] font-medium uppercase tracking-wide mb-4" style={{ color: "var(--text-tertiary)" }}>
              本週 vs 上週
            </p>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[13px] mb-1" style={{ color: "var(--text-tertiary)" }}>上週</p>
                <p className="text-[24px] font-bold" style={{ color: "var(--text-secondary)" }}>{stats.weekly.lastWeek}</p>
              </div>
              <div className="flex-1 flex items-center justify-center">
                {stats.thisWeekPct > 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <TrendingUp className="w-5 h-5" style={{ color: "var(--status-success)" }} aria-hidden="true" />
                    <span className="text-[13px] font-medium" style={{ color: "var(--status-success)" }}>+{stats.thisWeekPct}%</span>
                  </div>
                ) : stats.thisWeekPct < 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <TrendingUp className="w-5 h-5 rotate-180" style={{ color: "var(--status-danger)" }} aria-hidden="true" />
                    <span className="text-[13px] font-medium" style={{ color: "var(--status-danger)" }}>{stats.thisWeekPct}%</span>
                  </div>
                ) : (
                  <span className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>持平</span>
                )}
              </div>
              <div className="text-center">
                <p className="text-[13px] mb-1" style={{ color: "var(--text-tertiary)" }}>本週</p>
                <p className="text-[24px] font-bold" style={{ color: "var(--text-primary)" }}>{stats.weekly.thisWeek}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 總結語（正向心理學） */}
        {stats && stats.doneCount > 0 && (
          <motion.div
            className="rounded-2xl px-6 py-4 text-center"
            style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {stats.doneCount}
              </span>{" "}
              個任務被標記為完成。
              <br />
              你的大腦正在分泌多巴胺，每一次完成都是一次獎賞。
            </p>
          </motion.div>
        )}

        {/* 空狀態 */}
        {stats && stats.doneCount === 0 && (
          <motion.div
            className="card py-16 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
              <Heart className="w-7 h-7" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <p className="text-[16px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              你的金庫是空的
            </p>
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              完成第一個任務，開始累積多巴胺
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
