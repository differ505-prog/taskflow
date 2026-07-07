"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { clearAllData, exportAllData } from "@/lib/storage";
import { motion } from "framer-motion";
import {
  Moon, Sun, Bell, Download, Trash2, Info,
  ChevronRight, X, CheckCircle2, AlertCircle,
} from "lucide-react";

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPage({ isOpen, onClose }: SettingsPageProps) {
  const { notificationPermission, requestNotificationPermission, tasks, habits } = useApp();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("taskflow_theme") as "light" | "dark" | "system" | null;
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    }
  }, []);

  const applyTheme = (t: "light" | "dark" | "system") => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = t === "dark" || (t === "system" && prefersDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "");
  };

  const handleThemeChange = (t: "light" | "dark" | "system") => {
    setTheme(t);
    localStorage.setItem("taskflow_theme", t);
    applyTheme(t);
  };

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taskflow-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg("已匯出備份檔案");
    setTimeout(() => setExportMsg(null), 3000);
  };

  const handleClearAll = () => {
    clearAllData();
    window.location.reload();
  };

  const totalTasks = tasks.length;
  const totalHabits = habits.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5" style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>設定</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors" style={{ color: "var(--text-tertiary)" }} aria-label="關閉設定">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Theme */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>外觀</h3>
            <div className="flex gap-2">
              {([
                { value: "light" as const, label: "淺色", icon: <Sun className="w-4 h-4" /> },
                { value: "dark" as const, label: "深色", icon: <Moon className="w-4 h-4" /> },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleThemeChange(opt.value)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-medium transition-all duration-150 border"
                  style={
                    theme === opt.value
                      ? { background: "var(--brand-tint)", borderColor: "var(--brand)", color: "var(--brand)" }
                      : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                  }
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Notifications */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>提醒通知</h3>
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>系統推播</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>任務到期時收到提醒</p>
                </div>
                {notificationPermission === "granted" ? (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--status-success)" }}>
                    <CheckCircle2 className="w-4 h-4" /> 已授權
                  </span>
                ) : notificationPermission === "denied" ? (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--status-danger)" }}>
                    <AlertCircle className="w-4 h-4" /> 已拒絕
                  </span>
                ) : (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-3 py-1.5 rounded-xl text-[12px] font-medium"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                  >
                    開啟通知
                  </button>
                )}
              </div>
              <div className="h-px" style={{ background: "var(--border)" }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>番茄鐘提醒</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>專注時間結束時通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 rounded-full peer peer-checked:bg-brand bg-black/10 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            </div>
          </section>

          {/* Data */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>資料管理</h3>
            <div className="space-y-2">
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-between p-4 rounded-xl transition-colors hover:bg-black/5"
                style={{ background: "var(--surface-muted)" }}
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5" style={{ color: "var(--brand)" }} />
                  <div className="text-left">
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>匯出資料</p>
                    <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>下載 JSON 備份檔案</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
              </button>

              {exportMsg && (
                <p className="text-[12px] px-3" style={{ color: "var(--status-success)" }}>✓ {exportMsg}</p>
              )}

              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl transition-colors hover:bg-red-50/50"
                  style={{ background: "var(--surface-muted)" }}
                >
                  <Trash2 className="w-5 h-5" style={{ color: "var(--status-danger)" }} />
                  <div className="text-left">
                    <p className="text-[14px] font-medium" style={{ color: "var(--status-danger)" }}>清除所有資料</p>
                    <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>刪除所有任務、習慣與設定</p>
                  </div>
                </button>
              ) : (
                <div className="p-4 rounded-xl border" style={{ borderColor: "var(--status-danger)", background: "rgba(255,59,48,0.04)" }}>
                  <p className="text-[13px] mb-3" style={{ color: "var(--status-danger)" }}>確定要清除所有資料嗎？此操作無法復原。</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowClearConfirm(false)} className="btn-ghost flex-1 py-2 text-[13px]">取消</button>
                    <button onClick={handleClearAll} className="flex-1 py-2 rounded-xl text-[13px] font-medium text-white transition-all" style={{ background: "var(--status-danger)" }}>
                      確定清除
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Stats */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>統計資訊</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "總任務", value: totalTasks },
                { label: "已完成", value: completedTasks },
                { label: "習慣", value: totalHabits },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 rounded-xl" style={{ background: "var(--surface-muted)" }}>
                  <p className="text-[20px] font-semibold" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* About */}
          <section>
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "var(--surface-muted)" }}>
              <Info className="w-5 h-5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>TaskFlow v0.2.0</p>
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>本地端儲存 · 隱私優先</p>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
