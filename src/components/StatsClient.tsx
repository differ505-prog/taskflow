"use client";

import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Task } from "@/lib/types";
import { getTasks } from "@/lib/storage";

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

export default function StatsClient() {
  const { tasks, isLoaded } = useTaskStats();

  const stats = useMemo(() => {
    if (!isLoaded) return null;
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const overdue = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done"
    ).length;
    const highPriority = tasks.filter((t) => t.priority === "high" && t.status !== "done").length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const today = new Date().toISOString().split("T")[0];
    const dueToday = tasks.filter((t) => t.dueDate === today && t.status !== "done").length;

    return { total, done, inProgress, todo, overdue, highPriority, completionRate, dueToday };
  }, [tasks, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" role="status" aria-label="載入中" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
              <BarChart3 className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">統計</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* 完成率大卡片 */}
        {stats && (
          <motion.div
            className="card px-8 py-8 text-center"
            style={{ boxShadow: "var(--shadow-sm)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)] mb-3">
              任務完成率
            </p>
            <div className="relative inline-flex items-center justify-center mb-4">
              <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
                <circle
                  cx="70" cy="70" r="58"
                  fill="none"
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth="12"
                />
                <circle
                  cx="70" cy="70" r="58"
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.completionRate / 100) * 364.4} 364.4`}
                  strokeDashoffset="91.1"
                  style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[36px] font-bold" style={{ color: "var(--text-primary)" }}>
                  {stats.completionRate}%
                </span>
                <span className="text-[12px] text-[var(--text-tertiary)]">
                  {stats.done}/{stats.total}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--status-success)" }} aria-hidden="true" />
              <span>{stats.total - stats.done} 項待完成</span>
            </div>
          </motion.div>
        )}

        {/* 核心指標 */}
        <section aria-labelledby="stats-grid-heading">
          <h2 id="stats-grid-heading" className="sr-only">核心指標</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="全部任務"
              value={stats?.total ?? 0}
              icon={<BarChart3 className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} />}
            />
            <StatCard
              label="已完成"
              value={stats?.done ?? 0}
              highlight
              icon={<CheckCircle2 className="w-6 h-6" style={{ color: "var(--status-success)" }} />}
            />
            <StatCard
              label="進行中"
              value={stats?.inProgress ?? 0}
              sub={stats?.dueToday ? `今日截止 ${stats.dueToday} 項` : undefined}
              icon={<Clock className="w-6 h-6" style={{ color: "var(--brand)" }} />}
            />
            <StatCard
              label="高優先"
              value={stats?.highPriority ?? 0}
              sub={stats?.overdue ? `逾期 ${stats.overdue} 項` : undefined}
              icon={<AlertCircle className="w-6 h-6" style={{ color: "var(--status-danger)" }} />}
            />
          </div>
        </section>

        {/* 狀態分組 */}
        <section aria-labelledby="status-breakdown-heading">
          <h2 id="status-breakdown-heading" className="text-[13px] font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
            狀態分布
          </h2>
          <div className="space-y-2">
            {[
              { label: "待辦", count: stats?.todo ?? 0, color: "var(--text-tertiary)", total: stats?.total ?? 1 },
              { label: "進行中", count: stats?.inProgress ?? 0, color: "var(--brand)", total: stats?.total ?? 1 },
              { label: "已完成", count: stats?.done ?? 0, color: "var(--status-success)", total: stats?.total ?? 1 },
            ].map(({ label, count, color, total }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[13px] text-[var(--text-secondary)] w-12 text-right flex-shrink-0">
                    {label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, background: color }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${label}: ${pct}%`}
                      />
                    </div>
                  </div>
                  <span className="text-[12px] text-[var(--text-tertiary)] w-10 flex-shrink-0">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 優先級分組 */}
        <section aria-labelledby="priority-breakdown-heading">
          <h2 id="priority-breakdown-heading" className="text-[13px] font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
            優先級分布
          </h2>
          <div className="space-y-2">
            {[
              { label: "高優先", count: tasks.filter((t) => t.priority === "high").length, color: "var(--priority-high)" },
              { label: "中優先", count: tasks.filter((t) => t.priority === "medium").length, color: "var(--priority-medium)" },
              { label: "低優先", count: tasks.filter((t) => t.priority === "low").length, color: "var(--priority-low)" },
            ].map(({ label, count, color }) => {
              const total = tasks.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[13px] text-[var(--text-secondary)] w-12 text-right flex-shrink-0">{label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, background: color }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${label}: ${pct}%`}
                      />
                    </div>
                  </div>
                  <span className="text-[12px] text-[var(--text-tertiary)] w-10 flex-shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </section>

        {tasks.length === 0 && (
          <div className="card py-16 text-center">
            <p className="text-[14px] text-[var(--text-tertiary)]">
              尚無任務資料
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
