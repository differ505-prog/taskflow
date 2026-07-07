"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { useAuth, getBetaUsers, addBetaUser, removeBetaUser } from "@/lib/AuthContext";
import {
  clearAllData, exportAllData, downloadCSV, downloadJSON,
  exportTasksToCSV, exportHabitsToCSV, importData,
} from "@/lib/storage";
import { motion } from "framer-motion";
import {
  Moon, Sun, Bell, Download, Upload, Trash2, Info,
  ChevronRight, X, CheckCircle2, AlertCircle, FileText,
  CalendarDays, Copy, Shield, UserPlus, UserMinus, Crown, Sparkles,
} from "lucide-react";
import { getTasks } from "@/lib/storage";
import { downloadICal } from "@/lib/ical";
import { ROLE_CONFIGS, UserRole } from "@/lib/types";

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPage({ isOpen, onClose }: SettingsPageProps) {
  const { notificationPermission, requestNotificationPermission, tasks, habits, lists, addTask, addHabit, addList } = useApp();
  const { user, role, roleConfig, isAdmin } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importStats, setImportStats] = useState<{ tasks: number; habits: number; lists: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Role Management ────────────────────────────────────────
  const [betaUsers, setBetaUsers] = useState<string[]>([]);
  const [newBetaEmail, setNewBetaEmail] = useState("");
  const [betaMsg, setBetaMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBetaUsers(getBetaUsers());
    }
  }, [isOpen]);

  const handleAddBetaUser = () => {
    const email = newBetaEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes("@")) {
      setBetaMsg("請輸入有效的 Email");
      setTimeout(() => setBetaMsg(null), 3000);
      return;
    }
    if (getBetaUsers().map((e) => e.toLowerCase()).includes(email)) {
      setBetaMsg("此用戶已在列表中");
      setTimeout(() => setBetaMsg(null), 3000);
      return;
    }
    addBetaUser(email);
    setBetaUsers(getBetaUsers());
    setNewBetaEmail("");
    setBetaMsg(`已添加 ${email} 為早期測試者`);
    setTimeout(() => setBetaMsg(null), 3000);
  };

  const handleRemoveBetaUser = (email: string) => {
    removeBetaUser(email);
    setBetaUsers(getBetaUsers());
    setBetaMsg(`已移除 ${email}`);
    setTimeout(() => setBetaMsg(null), 3000);
  };

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

  const handleExportJSON = () => {
    const data = exportAllData();
    downloadJSON(data, `taskflow-backup-${new Date().toISOString().split("T")[0]}.json`);
    setExportMsg("已匯出 JSON 備份");
    setTimeout(() => setExportMsg(null), 3000);
  };

  const handleExportTasksCSV = () => {
    const csv = exportTasksToCSV(tasks);
    downloadCSV(csv, `taskflow-tasks-${new Date().toISOString().split("T")[0]}.csv`);
    setExportMsg("已匯出任務 CSV");
    setTimeout(() => setExportMsg(null), 3000);
  };

  const handleExportHabitsCSV = () => {
    const csv = exportHabitsToCSV(habits);
    downloadCSV(csv, `taskflow-habits-${new Date().toISOString().split("T")[0]}.csv`);
    setExportMsg("已匯出習慣 CSV");
    setTimeout(() => setExportMsg(null), 3000);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = JSON.parse(text);
      const result = importData(text, tasks, habits, lists);
      if (result.success) {
        if (result.tasks > 0 && Array.isArray(parsed.tasks)) {
          parsed.tasks.forEach((t: any) => {
            addTask({
              title: t.title,
              description: t.description || "",
              priority: t.priority || "medium",
              status: t.status || "todo",
              dueDate: t.dueDate || undefined,
              dueTime: t.dueTime || undefined,
              tags: t.tags || [],
              subTasks: t.subTasks || [],
              recurrence: t.recurrence || undefined,
              listId: t.listId || undefined,
            });
          });
        }
        if (result.habits > 0 && Array.isArray(parsed.habits)) {
          parsed.habits.forEach((h: any) => {
            addHabit({
              title: h.title || h.name || "",
              description: h.description || "",
              frequency: h.frequency || "daily",
              targetCount: h.targetCount || h.target || 1,
              color: h.color || "#4F6AF5",
            });
          });
        }
        if (result.lists > 0 && Array.isArray(parsed.lists)) {
          parsed.lists.forEach((l: any) => {
            addList({
              name: l.name,
              icon: l.icon || "📋",
              color: l.color || "#4F6AF5",
            });
          });
        }
        setImportStats({ tasks: result.tasks, habits: result.habits, lists: result.lists });
        setImportErrors(result.errors);
        setImportMsg(`成功匯入 ${result.tasks} 項任務、${result.habits} 項習慣、${result.lists} 個清單`);
      } else {
        setImportMsg("匯入失敗");
        setImportErrors(result.errors);
      }
      setTimeout(() => { setImportMsg(null); setImportErrors([]); setImportStats(null); }, 5000);
    };
    reader.readAsText(file);
    e.target.value = "";
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

          {/* User Role */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
              帳戶權限
            </h3>

            {/* Current Role Badge */}
            <div
              className="p-4 rounded-xl mb-3"
              style={{
                background: roleConfig.badgeBg,
                border: `1px solid ${roleConfig.badgeColor}20`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: roleConfig.badgeColor }}
                >
                  {role === "admin" ? (
                    <Crown className="w-5 h-5 text-white" />
                  ) : role === "beta" ? (
                    <Sparkles className="w-5 h-5 text-white" />
                  ) : (
                    <Shield className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold" style={{ color: roleConfig.badgeColor }}>
                      {roleConfig.label}
                    </p>
                    {role !== "free" && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: roleConfig.badgeColor,
                          color: "white",
                        }}
                      >
                        {role === "admin" ? "創辦人" : "VIP"}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {roleConfig.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Permission Details */}
            <div className="card p-4 space-y-3">
              {/* Upload Permission */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>檔案上傳</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {role === "admin" ? "無限制" : role === "beta" ? "最大 5MB/單檔" : "暫未開放"}
                  </p>
                </div>
                {roleConfig.canUpload ? (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--status-success)" }}>
                    <CheckCircle2 className="w-4 h-4" /> 已啟用
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    <AlertCircle className="w-4 h-4" /> 已停用
                  </span>
                )}
              </div>

              {/* Role Comparison */}
              <div style={{ height: "1px", background: "var(--border)" }} />
              <div className="space-y-2">
                <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>角色說明</p>
                {(["admin", "beta", "free"] as UserRole[]).map((r) => {
                  const cfg = ROLE_CONFIGS[r];
                  const isCurrent = r === role;
                  return (
                    <div
                      key={r}
                      className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                      style={{
                        background: isCurrent ? cfg.badgeBg : "transparent",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: cfg.badgeColor }}
                      >
                        {r === "admin" ? (
                          <Crown className="w-3.5 h-3.5 text-white" />
                        ) : r === "beta" ? (
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: isCurrent ? cfg.badgeColor : "var(--text-primary)" }}>
                          {cfg.label}
                          {isCurrent && "（目前）"}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                          {cfg.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Beta User Management (Admin Only) */}
            {isAdmin && (
              <div className="mt-4">
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <UserPlus className="w-4 h-4" style={{ color: "var(--brand)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      早期測試者管理
                    </p>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-1"
                      style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                    >
                      創辦人專區
                    </span>
                  </div>
                  <p className="text-[12px] mb-3" style={{ color: "var(--text-tertiary)" }}>
                    手動開通早期測試者資格，賦予上傳功能（5MB/單檔限制）
                  </p>

                  {/* Add Beta User */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      value={newBetaEmail}
                      onChange={(e) => setNewBetaEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddBetaUser()}
                      placeholder="輸入用戶 Email"
                      className="input flex-1 text-[13px]"
                      style={{ padding: "10px 12px" }}
                    />
                    <button
                      onClick={handleAddBetaUser}
                      className="btn-primary px-4 flex-shrink-0"
                    >
                      添加
                    </button>
                  </div>

                  {/* Beta Users List */}
                  {betaUsers.length > 0 ? (
                    <div className="space-y-2">
                      {betaUsers.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between p-2.5 rounded-lg"
                          style={{ background: "var(--surface-elevated)" }}
                        >
                          <span className="text-[13px] truncate flex-1" style={{ color: "var(--text-primary)" }}>
                            {email}
                          </span>
                          <button
                            onClick={() => handleRemoveBetaUser(email)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 ml-2"
                            style={{ color: "var(--status-danger)" }}
                            aria-label={`移除 ${email}`}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                      尚無早期測試者
                    </p>
                  )}

                  {betaMsg && (
                    <p
                      className="text-[12px] mt-3 px-3 py-2 rounded-lg"
                      style={{
                        background: betaMsg.includes("無效") || betaMsg.includes("已在")
                          ? "rgba(255,149,0,0.08)"
                          : "rgba(52,199,89,0.08)",
                        color: betaMsg.includes("無效") || betaMsg.includes("已在")
                          ? "var(--status-warning)"
                          : "var(--status-success)",
                      }}
                    >
                      {betaMsg}
                    </p>
                  )}
                </div>
              </div>
            )}
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

              {/* Export */}
              <div>
                <p className="text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>匯出資料</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleExportJSON} className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-all active:scale-95" style={{ background: "var(--brand)", color: "white" }}>
                    <Download className="w-4 h-4" /> JSON
                  </button>
                  <button onClick={handleExportTasksCSV} className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-all active:scale-95" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                    <FileText className="w-4 h-4" /> 任務 CSV
                  </button>
                </div>
                <button onClick={handleExportHabitsCSV} className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-95" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
                  <Download className="w-4 h-4" /> 習慣 CSV
                </button>
              </div>

              {exportMsg && (
                <p className="text-[12px] px-3 py-2 rounded-xl" style={{ background: "rgba(52,199,89,0.08)", color: "var(--status-success)" }}>
                  ✓ {exportMsg}
                </p>
              )}

              <div style={{ height: "1px", background: "var(--border)" }} />

              {/* Import */}
              <div>
                <p className="text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>匯入資料</p>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} id="import-json-input" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-between p-4 rounded-xl transition-colors hover:bg-black/5"
                  style={{ background: "var(--surface-muted)" }}
                >
                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                    <div className="text-left">
                      <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>匯入 JSON 備份</p>
                      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>還原之前匯出的資料</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
                </button>
                {importMsg && (
                  <div className="mt-2 px-3 py-2.5 rounded-xl text-[13px]" style={{ background: importErrors.length > 0 ? "rgba(255,149,0,0.08)" : "rgba(52,199,89,0.08)", color: importErrors.length > 0 ? "var(--status-warning)" : "var(--status-success)" }}>
                    {importMsg}
                    {importStats && (
                      <div className="mt-1 text-[12px] opacity-80">
                        任務 {importStats.tasks} · 習慣 {importStats.habits} · 清單 {importStats.lists}
                      </div>
                    )}
                    {importErrors.length > 0 && (
                      <div className="mt-1 text-[12px]" style={{ color: "var(--status-danger)" }}>
                        {importErrors.slice(0, 3).join("；")}
                        {importErrors.length > 3 && `...共 ${importErrors.length} 項`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ height: "1px", background: "var(--border)" }} />

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

          {/* Calendar Sync */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
              日曆同步
            </h3>
            <div className="space-y-3">
              {/* Copy subscription link */}
              {(() => {
                const [calCopied, setCalCopied] = useState(false);
                const handleCopy = async () => {
                  const tasks = getTasks();
                  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(tasks))));
                  const url = `${window.location.origin}/api/calendar/feed?tasks=${encoded}`;
                  await navigator.clipboard.writeText(url);
                  setCalCopied(true);
                  setTimeout(() => setCalCopied(false), 2500);
                };
                return (
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98 hover:bg-[var(--surface-hover)]"
                    style={{ background: "var(--surface-muted)" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-tint)" }}>
                      <Copy className="w-5 h-5" style={{ color: "var(--brand)" }} />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>複製日曆訂閱連結</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        貼到 Google Calendar 訂閱，有新增或編輯任務時回來重新複製即可
                      </p>
                    </div>
                    <span
                      className="text-[12px] font-medium flex-shrink-0 px-3 py-1.5 rounded-xl transition-all"
                      style={calCopied
                        ? { background: "rgba(52,199,89,0.1)", color: "var(--status-success)" }
                        : { background: "var(--brand-tint)", color: "var(--brand)" }}
                    >
                      {calCopied ? "已複製 ✓" : "複製連結"}
                    </span>
                  </button>
                );
              })()}

              {/* How to use instructions */}
              <div className="p-4 rounded-xl space-y-3" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>使用方式</p>
                <div className="space-y-3">
                  {[
                    {
                      label: "複製連結",
                      text: "點擊上方「複製連結」按鈕",
                    },
                    {
                      label: "打開 Google Calendar",
                      text: "在新分頁打開 ",
                      link: { href: "https://calendar.google.com", label: "Google Calendar" },
                    },
                    {
                      label: "加入日曆",
                      text: "左側「加入其他日曆」→「從網址加入日曆」",
                    },
                    {
                      label: "完成訂閱",
                      text: "貼上剛複製的連結，點確認。日曆會顯示目前所有任務",
                    },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 text-[10px] font-bold"
                        style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{step.label}：</span>
                        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>{step.text}</span>
                        {"link" in step && step.link && (
                          <a
                            href={step.link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] underline underline-offset-2 ml-1"
                            style={{ color: "var(--brand)" }}
                          >
                            {step.link.label} ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 理論基礎 */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
              理論基礎
            </h3>
            <div className="space-y-3">
              <div
                className="p-4 rounded-xl border"
                style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "var(--brand-tint)" }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: "var(--brand)" }}>E</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>艾森豪矩陣</p>
                    <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      四象限決策框架：Ⅰ重要×緊急→立即做；Ⅱ重要×不緊急→計劃做；
                      Ⅲ不重要×緊急→委派做；Ⅳ不重要×不緊急→刪除。把精力投入最有價值的事，而非被緊急事務追著跑。
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="p-4 rounded-xl border"
                style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "var(--brand-tint)" }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: "var(--brand)" }}>G</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>GTD 時間管理法</p>
                    <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      收集箱用來清空大腦工作記憶，降低認知負載。
                      「今天」與「未來 7 天」視圖將龐大待辦清單化為可執行的下一步行動。
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="p-4 rounded-xl border"
                style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(255,149,0,0.1)" }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: "var(--status-warning)" }}>P</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>番茄工作法</p>
                    <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      25 分鐘高度專注工作區塊，配合短休息形成心流節奏。
                      內建計時器讓你不必切換工具，專注當下最重要的事。
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2 px-1">
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  VibeList v0.2.0 · 本地端儲存 · 隱私優先
                </p>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
