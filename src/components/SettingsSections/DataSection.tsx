/**
 * DataSection — 資料管理區塊
 *
 * 職責: 備份提醒、匯出 JSON、匯入 JSON、清除所有資料
 * 從 SettingsContext 取 exportMsg/importMsg/importErrors/importStats/fileInputRef
 * 從 useApp 取 tasks/habits/lists/addTask/addHabit/addList
 */
"use client";

import { useState, useEffect } from "react";
import { Download, Upload, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSettingsContext } from "./index";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";
import {
  clearAllData, exportAllData,
  recordBackupAt, getLastBackupAt, getDaysSinceBackup,
} from "@/lib/storage";
import { shareOrDownloadBackup, fallbackDownload } from "@/lib/shareBackup";
import { importData } from "@/lib/storage";
import type { Task, Habit, TaskList } from "@/lib/types";

interface DataSectionProps {
  tasks: Task[];
  habits: Habit[];
  lists: TaskList[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => string;
  addHabit: (habit: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => void;
  addList: (list: Omit<TaskList, "id" | "createdAt" | "updatedAt" | "order">) => string;
}

export function DataSection({ tasks, habits, lists, addTask, addHabit, addList }: DataSectionProps) {
  const {
    exportMsg, setExportMsg,
    importMsg, setImportMsg,
    importErrors, setImportErrors,
    importStats, setImportStats,
    fileInputRef,
  } = useSettingsContext();
  const confirm = useConfirm();

  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [daysSinceBackup, setDaysSinceBackup] = useState<number>(Infinity);

  useEffect(() => {
    setLastBackupAt(getLastBackupAt());
    setDaysSinceBackup(getDaysSinceBackup());
  }, []);

  const handleExportJSON = async () => {
    const data = exportAllData();
    const filename = `taskflow-backup-${new Date().toISOString().split("T")[0]}.json`;
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
              title: t.title || "",
              description: t.description || "",
              priority: t.priority || "medium",
              status: t.status || "todo",
              dueDate: t.dueDate || undefined,
              dueTime: t.dueTime || undefined,
              tags: t.tags || [],
              subTasks: t.subTasks || [],
              recurrence: t.recurrence || undefined,
              listId: t.listId || undefined,
              focusMinutes: t.focusMinutes || 0,
              isArchived: !!t.isArchived,
              order: t.order || 0,
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
              name: l.name || "",
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

  const handleClearAll = async () => {
    const ok = await confirm({
      intent: "delete",
      title: "清除所有資料",
      message: "所有任務、清單、習慣、設定將從本機與雲端完全移除。匯出備份後再清除可避免資料遺失。",
      impactDetail: `${tasks.length} 項任務 · ${habits.length} 個習慣 · ${lists.length} 個清單將永久刪除`,
      tone: "danger",
    });
    if (!ok) return;
    clearAllData();
    toast.success(`已清除 ${tasks.length} 項任務、${habits.length} 個習慣、${lists.length} 個清單`);
    setTimeout(() => window.location.reload(), 600);
  };

  const days = daysSinceBackup;
  const isNever = days === Infinity;
  const isWarning = !isNever && days >= 7;
  const isRecent = !isNever && days < 7;

  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>資料管理</h3>

      {/* Backup status banner */}
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

      <div className="space-y-2">
        {/* Export */}
        <div>
          <p className="text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>匯出資料</p>
          <button
            onClick={() => void handleExportJSON()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-all active:scale-95"
            style={{ background: "var(--brand)", color: "white" }}
            aria-label="匯出 JSON 備份"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> JSON 備份
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
            className="w-full flex items-center justify-between p-4 rounded-xl transition-colors hover:bg-[var(--hover-bg)]"
            style={{ background: "var(--surface-muted)" }}
          >
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
              <div className="text-left">
                <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>匯入 JSON 備份</p>
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>還原之前匯出的資料</p>
              </div>
            </div>
          </button>
          {importMsg && (
            <div
              className="mt-2 px-3 py-2.5 rounded-xl text-[13px]"
              style={{
                background: importErrors.length > 0 ? "rgba(255,149,0,0.08)" : "rgba(52,199,89,0.08)",
                color: importErrors.length > 0 ? "var(--status-warning)" : "var(--status-success)",
              }}
            >
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
          onClick={() => void handleClearAll()}
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
  );
}
