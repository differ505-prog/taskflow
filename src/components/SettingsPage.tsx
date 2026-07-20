"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import {
  clearAllData, exportAllData, downloadJSON,
  importData,
  recordBackupAt, getLastBackupAt, getDaysSinceBackup,
} from "@/lib/storage";
import { shareOrDownloadBackup, fallbackDownload } from "@/lib/shareBackup";
import { motion } from "framer-motion";
import {
  Moon, Sun, Bell, Download, Upload, Trash2, Info,
  ChevronRight, X, CheckCircle2, AlertCircle,
  CalendarDays, Shield, UserPlus, UserMinus, Crown, Sparkles, Zap, Copy,
  Heart, Lock, Package,
} from "lucide-react";
import { getTasks } from "@/lib/storage";
import { TemplateMarketplace } from "./TemplateMarketplace";
import { downloadICal } from "@/lib/ical";
import { useWebhookSettings, triggerWebhook } from "@/lib/useWebhook";
import { ROLE_CONFIGS, UserRole } from "@/lib/types";
import { getConfettiEnabled, setConfettiEnabled, previewConfetti } from "@/lib/confetti";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { isComposingKey } from "@/utils/imeGuard";
import { ProGhostButton } from "./ProGhostButton";

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPage({ isOpen, onClose }: SettingsPageProps) {
  const { notificationPermission, requestNotificationPermission, tasks, habits, lists, addTask, addHabit, addList } = useApp();
  const { user, role, roleConfig, isAdmin } = useAuth();
  const confirm = useConfirm();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importStats, setImportStats] = useState<{ tasks: number; habits: number; lists: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [daysSinceBackup, setDaysSinceBackup] = useState<number>(Infinity);
  // ── Webhook 整合狀態 ──
  const webhook = useWebhookSettings();
  const [webhookDraft, setWebhookDraft] = useState("");
  const [webhookTestMsg, setWebhookTestMsg] = useState<string | null>(null);
  const [webhookSaved, setWebhookSaved] = useState(false);

  // ── Webcal URL（動態，base URL + /api/calendar/webcal）─────
  const [webcalUrlCopied, setWebcalUrlCopied] = useState(false);
  const getWebcalUrl = useCallback((): string => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/calendar/webcal`;
  }, []);

  const handleCopyWebcalUrl = useCallback(async () => {
    const url = getWebcalUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setWebcalUrlCopied(true);
    toast.success("Webcal 連結已複製！");
    setTimeout(() => setWebcalUrlCopied(false), 2500);
  }, [getWebcalUrl]);

  const handleOpenWebcalGoogle = useCallback(() => {
    const url = getWebcalUrl();
    window.open(
      `https://calendar.google.com/calendar/r/settings/addcalendar?splash=2&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [getWebcalUrl]);

  // ── Confetti 慶祝動畫設定 ──
  const [confettiEnabled, setConfettiEnabledState] = useState(true);
  useEffect(() => {
    setConfettiEnabledState(getConfettiEnabled());
  }, []);
  const handleConfettiToggle = (enabled: boolean) => {
    setConfettiEnabledState(enabled);
    setConfettiEnabled(enabled);
  };

  // ── Role Management（從 useAuth 取得雲端 Beta 名單）──────
  const { betaUsers, betaLoading, addBetaUser: cloudAddBeta, removeBetaUser: cloudRemoveBeta } = useAuth();
  const [newBetaEmail, setNewBetaEmail] = useState("");
  const [betaMsg, setBetaMsg] = useState<string | null>(null);
  const [betaBusy, setBetaBusy] = useState(false);

  const handleAddBetaUser = async () => {
    if (betaBusy) return;
    const email = newBetaEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setBetaMsg("請輸入有效的 Email");
      setTimeout(() => setBetaMsg(null), 3000);
      return;
    }
    if (betaUsers.map((e) => e.toLowerCase()).includes(email)) {
      setBetaMsg("此用戶已在列表中");
      setTimeout(() => setBetaMsg(null), 3000);
      return;
    }
    try {
      setBetaBusy(true);
      await cloudAddBeta(email);
      setNewBetaEmail("");
      setBetaMsg(`已將 ${email} 加入雲端名單，所有裝置即時生效`);
      setTimeout(() => setBetaMsg(null), 3000);
    } catch (err: any) {
      setBetaMsg(`加入失敗：${err?.message || "未知錯誤"}`);
      setTimeout(() => setBetaMsg(null), 4000);
    } finally {
      setBetaBusy(false);
    }
  };

  const handleRemoveBetaUser = async (email: string) => {
    if (betaBusy) return;
    try {
      setBetaBusy(true);
      await cloudRemoveBeta(email);
      setBetaMsg(`已從所有裝置移除 ${email}`);
      setTimeout(() => setBetaMsg(null), 3000);
    } catch (err: any) {
      setBetaMsg(`移除失敗：${err?.message || "未知錯誤"}`);
      setTimeout(() => setBetaMsg(null), 4000);
    } finally {
      setBetaBusy(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("taskflow_theme") as "light" | "dark" | "system" | null;
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    }
    // L3 自動化備份：開啟設定時載入上次備份時間
    setLastBackupAt(getLastBackupAt());
    setDaysSinceBackup(getDaysSinceBackup());
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

  const handleClearAll = async () => {
    const ok = await confirm({
      title: "清除所有資料",
      message: "所有任務、清單、習慣、設定將從本機與雲端完全移除。匯出備份後再清除可避免資料遺失。",
      impactDetail: `${tasks.length} 項任務 · ${habits.length} 個習慣 · ${lists.length} 個清單將永久刪除`,
      confirmText: "永久清除",
      cancelText: "取消",
      tone: "danger",
    });
    if (!ok) return;
    clearAllData();
    toast.success(`已清除 ${tasks.length} 項任務、${habits.length} 個習慣、${lists.length} 個清單`);
    setTimeout(() => window.location.reload(), 600);
  };

  const handleExportJSON = async () => {
    const data = exportAllData();
    const filename = `taskflow-backup-${new Date().toISOString().split("T")[0]}.json`;

    // 優先用 Web Share API(手機原生分享面板:存 Files/AirDrop/傳 LINE/Email 自己)
    // 不支援或失敗時降級到 <a download>
    await shareOrDownloadBackup({
      data,
      filename,
      onFallback: () => {
        fallbackDownload(data, filename);
        recordBackupAt();
        setLastBackupAt(getLastBackupAt());
        setDaysSinceBackup(getDaysSinceBackup());
        setExportMsg("已下載 JSON 備份");
        setTimeout(() => setExportMsg(null), 3000);
      },
      onShared: () => {
        recordBackupAt();
        setLastBackupAt(getLastBackupAt());
        setDaysSinceBackup(getDaysSinceBackup());
        setExportMsg("已分享 JSON 備份");
        setTimeout(() => setExportMsg(null), 3000);
      },
      // onCancelled: 用戶主動關掉分享面板,靜默處理(不顯示訊息)
    });
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

          {/* PRO 功能（幽靈按鈕埋點） */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
              <Crown className="w-3.5 h-3.5" aria-hidden="true" />
              PRO 功能搶先看
            </h3>
            <div className="space-y-2">
              {/* Karma Mode 開關（幽靈） */}
              <div className="card px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(244, 63, 94, 0.10)" }}
                  >
                    <Heart className="w-4 h-4" style={{ color: "#F43F5E" }} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Karma Mode</p>
                    <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>
                      心靈還債引擎 · 拖延會扣信用血條
                    </p>
                  </div>
                </div>
                <ProGhostButton feature="karma-mode" variant="inline" title="啟用 Karma Mode（PRO 專屬）">
                  <span>啟用</span>
                </ProGhostButton>
              </div>

              {/* 儲存空間管理（幽靈） */}
              <div className="card px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--brand-tint)" }}
                  >
                    <Package className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>加大儲存空間</p>
                    <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>
                      ZIP 備份、大檔清理、滿載加購
                    </p>
                  </div>
                </div>
                <ProGhostButton feature="storage-cleaner" variant="inline" title="管理儲存空間（PRO 專屬）">
                  <span>管理</span>
                </ProGhostButton>
              </div>
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
                      早期測試者管理（雲端）
                    </p>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-1"
                      style={{ background: "rgba(52,199,89,0.12)", color: "var(--status-success)" }}
                    >
                      🌐 所有裝置即時同步
                    </span>
                  </div>
                  <p className="text-[12px] mb-3" style={{ color: "var(--text-tertiary)" }}>
                    手動開通早期測試者資格，賦予上傳功能（5MB/單檔限制）。新增後對方下次登入即生效。
                  </p>

                  {/* Add Beta User */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      value={newBetaEmail}
                      onChange={(e) => setNewBetaEmail(e.target.value)}
                      onKeyDown={(e) => { if (!isComposingKey(e) && e.key === "Enter") handleAddBetaUser(); }}
                      placeholder="輸入用戶 Email"
                      className="input flex-1 text-[13px]"
                      style={{ padding: "10px 12px" }}
                      disabled={betaBusy}
                    />
                    <button
                      onClick={handleAddBetaUser}
                      className="btn-primary px-4 flex-shrink-0 disabled:opacity-50"
                      disabled={betaBusy}
                    >
                      {betaBusy ? "處理中…" : "添加"}
                    </button>
                  </div>

                  {/* Beta Users List */}
                  {betaLoading ? (
                    <p className="text-[12px] text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                      從雲端載入…
                    </p>
                  ) : betaUsers.length > 0 ? (
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
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 ml-2 disabled:opacity-50"
                            style={{ color: "var(--status-danger)" }}
                            aria-label={`移除 ${email}`}
                            disabled={betaBusy}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                      雲端名單為空，新增第一位測試者吧
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

          {/* Interaction / 互動體驗 */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
              互動體驗
            </h3>
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                    完成任務慶祝動畫
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    標記任務為完成時顯示 confetti
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={confettiEnabled}
                    onChange={(e) => handleConfettiToggle(e.target.checked)}
                    aria-label="啟用完成任務慶祝動畫"
                  />
                  <div className="w-11 h-6 rounded-full peer peer-checked:bg-brand bg-black/10 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
              {confettiEnabled && (
                <>
                  <div className="h-px" style={{ background: "var(--border)" }} />
                  <button
                    onClick={previewConfetti}
                    className="w-full py-2 rounded-xl text-[13px] font-medium transition-all duration-150 hover:opacity-80"
                    style={{
                      background: "var(--brand-tint)",
                      color: "var(--brand)",
                    }}
                  >
                    預覽效果
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Templates */}
          <section>
            <div className="card p-4">
              <TemplateMarketplace embedded />
            </div>
          </section>

          {/* Data */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>資料管理</h3>

            {/* L3 自動化備份提醒 */}
            {(() => {
              const days = daysSinceBackup;
              const isNever = days === Infinity;
              const isWarning = !isNever && days >= 7;
              const isRecent = !isNever && days < 7;
              return (
                <div
                  className="mb-3 px-4 py-3 rounded-xl flex items-center gap-3"
                  style={{
                    background: isWarning ? "rgba(255,149,0,0.08)" : isNever ? "rgba(59,130,246,0.08)" : "rgba(52,199,89,0.08)",
                    border: `1px solid ${isWarning ? "rgba(255,149,0,0.25)" : isNever ? "rgba(59,130,246,0.25)" : "rgba(52,199,89,0.25)"}`,
                  }}
                  role="status"
                >
                  <Shield className="w-4 h-4 flex-shrink-0" style={{ color: isWarning ? "var(--status-warning)" : isNever ? "var(--brand)" : "var(--status-success)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: isWarning ? "var(--status-warning)" : isNever ? "var(--brand)" : "var(--status-success)" }}>
                      {isNever ? "從未備份過" : isWarning ? `已 ${days} 天未備份` : `上次備份 ${days === 0 ? "今天" : `${days} 天前`}`}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                      {isNever ? "建議立即匯出一次 JSON 備份" : isWarning ? "備份有助於資料安全，點上方按鈕匯出" : "備份狀態良好"}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">

              {/* Export */}
              <div>
                <p className="text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>匯出資料</p>
                <button onClick={handleExportJSON} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-all active:scale-95" style={{ background: "var(--brand)", color: "white" }}>
                  <Download className="w-4 h-4" /> JSON 備份
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  aria-hidden="true"
                  tabIndex={-1}
                  className="hidden"
                  onChange={handleImportJSON}
                />
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

              <button
                onClick={handleClearAll}
                className="w-full flex items-center gap-3 p-4 rounded-xl transition-colors hover:bg-red-50/50"
                style={{ background: "var(--surface-muted)" }}
              >
                <Trash2 className="w-5 h-5" style={{ color: "var(--status-danger)" }} />
                <div className="text-left">
                  <p className="text-[14px] font-medium" style={{ color: "var(--status-danger)" }}>清除所有資料</p>
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>刪除所有任務、習慣與設定</p>
                </div>
              </button>
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
              {/* ── Webcal 動態訂閱（新）── */}
              <div
                className="p-4 rounded-xl space-y-3"
                style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52,199,89,0.1)" }}>
                    <CalendarDays className="w-5 h-5" style={{ color: "#34C759" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                      日曆訂閱（自動同步）
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      複製連結到 Google Calendar / Apple Calendar，自動同步最新任務
                    </p>
                  </div>
                </div>

                {/* URL 顯示 + 複製 */}
                <div
                  className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                >
                  <span
                    className="flex-1 text-[11px] truncate font-mono"
                    style={{ color: "var(--text-secondary)" }}
                    title={getWebcalUrl()}
                  >
                    {getWebcalUrl() || "載入中..."}
                  </span>
                  <button
                    onClick={handleCopyWebcalUrl}
                    className="p-1.5 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                    title="複製連結"
                  >
                    {webcalUrlCopied ? (
                      <span className="text-[11px] font-medium" style={{ color: "var(--status-success)" }}>已複製 ✓</span>
                    ) : (
                      <Copy className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
                    )}
                  </button>
                </div>

                {/* 一鍵加入按鈕 */}
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenWebcalGoogle}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-97"
                    style={{ background: "rgba(52,199,89,0.1)", color: "#34C759" }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-2-8v-4l3 3-3 3v-2H7v-4h3z" fill="currentColor"/>
                    </svg>
                    加入 Google Calendar
                  </button>
                  <button
                    onClick={handleCopyWebcalUrl}
                    className="flex-shrink-0 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all active:scale-97"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                  >
                    {webcalUrlCopied ? "已複製 ✓" : "複製連結"}
                  </button>
                </div>

                <p className="text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
                  需要登入帳號，連結含個人識別，請勿外流
                </p>
              </div>

              {/* ── 下載 .ics 檔案（維持現有）── */}
              <button
                onClick={() => {
                  downloadICal(getTasks(), "VibeList 任務");
                  setExportMsg("已下載 .ics 檔案");
                  setTimeout(() => setExportMsg(null), 3000);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98 hover:bg-[var(--surface-hover)]"
                style={{ background: "var(--surface-muted)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-tint)" }}>
                  <CalendarDays className="w-5 h-5" style={{ color: "var(--brand)" }} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>下載日曆檔案</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    匯出為 .ics 檔案，匯入 Google Calendar 或 Apple Calendar
                  </p>
                </div>
                <span
                  className="text-[12px] font-medium flex-shrink-0 px-3 py-1.5 rounded-xl"
                  style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                >
                  下載 .ics
                </span>
              </button>

              {/* How to use instructions */}
              <div className="p-4 rounded-xl space-y-3" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>匯入 Google Calendar 步驟</p>
                <div className="space-y-3">
                  {[
                    {
                      label: "下載檔案",
                      text: "點擊上方「下載 .ics」按鈕，會下載一個「VibeList 任務.ics」檔案",
                    },
                    {
                      label: "打開 Google Calendar",
                      text: "在新分頁打開 ",
                      link: { href: "https://calendar.google.com", label: "Google Calendar" },
                    },
                    {
                      label: "匯入日曆",
                      text: "「設定」→「匯入」→「選擇檔案」，上傳剛下載的 .ics",
                    },
                    {
                      label: "完成",
                      text: "選取要加入的日曆後點確認。即可在 Google Calendar 看見所有任務",
                    },
                    {
                      label: "更新同步",
                      text: "新增或編輯任務後，回來重新下載一次 .ics 檔案即可",
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

          {/* 自動化整合 — Outbound Webhook（Zapier / Make / n8n） */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
              自動化整合
            </h3>
            <div className="space-y-3">
              {/* URL 輸入 + 操作 */}
              <div
                className="p-4 rounded-xl space-y-3"
                style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--brand-tint)" }}
                  >
                    <Zap className="w-5 h-5" style={{ color: "var(--brand)" }} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                      Webhook URL
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      任務變動時會 POST payload 到此 URL。可整合 Zapier、Make、n8n 等自動化平台。
                    </p>
                  </div>
                </div>

                {/* Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={webhookDraft ?? (webhook.url ?? "")}
                    placeholder="https://hooks.zapier.com/..."
                    onChange={(e) => { setWebhookDraft(e.target.value); setWebhookSaved(false); }}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[13px]"
                    style={{
                      background: "var(--surface-elevated)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                    }}
                    aria-label="Webhook URL"
                  />
                  <button
                    onClick={() => {
                      if (!webhookDraft || !webhookDraft.trim()) {
                        webhook.clear();
                        setWebhookTestMsg("已清除");
                      } else {
                        webhook.update(webhookDraft.trim());
                        setWebhookSaved(true);
                        setWebhookTestMsg("已儲存");
                      }
                      setTimeout(() => setWebhookTestMsg(null), 2500);
                    }}
                    className="px-3 py-2 rounded-xl text-[12.5px] font-medium flex-shrink-0"
                    style={{
                      background: "var(--brand-tint)",
                      color: "var(--brand)",
                    }}
                    disabled={!webhookDraft && !webhook.url}
                  >
                    {webhook.url ? "更新" : "儲存"}
                  </button>
                  <button
                    onClick={() => {
                      // §1 主動 emit 一筆測試 payload
                      const url = webhook.url;
                      if (!url) { setWebhookTestMsg("請先儲存 URL"); setTimeout(() => setWebhookTestMsg(null), 2500); return; }
                      triggerWebhook({
                        timestamp: new Date().toISOString(),
                        event: "batch",
                        source: "user_test",
                        data: { hello: "world", tasks: getTasks().length, type: "test" },
                      });
                      setWebhookTestMsg("已送出測試 payload（檢查 Zapier/Make）");
                      setTimeout(() => setWebhookTestMsg(null), 3000);
                    }}
                    className="px-3 py-2 rounded-xl text-[12.5px] font-medium flex-shrink-0"
                    style={{
                      background: "var(--surface-elevated)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                    aria-label="送出測試"
                  >
                    測試
                  </button>
                </div>

                {/* 狀態訊息 */}
                {webhookTestMsg && (
                  <p className="text-[11.5px]" style={{ color: webhookSaved ? "var(--status-success)" : "var(--text-secondary)" }}>
                    {webhookTestMsg}
                  </p>
                )}

                {/* §8 資安提示 */}
                <div className="text-[10.5px] leading-relaxed pt-1" style={{ color: "var(--text-tertiary)" }}>
                  <strong>資安提醒：</strong> Webhook URL 儲存於本機 localStorage,且 payload 透過瀏覽器直接 POST 到您設定的 endpoint。建議使用 HTTPS endpoint,並定期更換以免外洩。
                </div>
              </div>

              {/* 使用說明 */}
              <div className="p-4 rounded-xl space-y-2" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>Zapier 整合步驟</p>
                <ol className="text-[11.5px] space-y-1 list-decimal pl-5" style={{ color: "var(--text-tertiary)" }}>
                  <li>在 Zapier 建立 Catch Hook trigger,複製其 Webhook URL</li>
                  <li>貼到上方輸入框,點「儲存」</li>
                  <li>點「測試」確認 payload 有送達 Zapier</li>
                  <li>後續任何任務新增/編輯/刪除都會自動觸發</li>
                </ol>
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
