"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Trash2, Download, Moon, Bell, Shield, Info, CalendarDays, Copy, Check, type LucideIcon } from "lucide-react";
import { getTasks } from "@/lib/storage";
import { downloadICal } from "@/lib/ical";

export default function SettingsPage() {
  type SettingsItem =
    | { icon: LucideIcon; label: string; description: string; type: "info"; value: string; onClick?: never }
    | { icon: LucideIcon; label: string; description: string; type: "action"; value?: string; onClick: () => void }
    | { icon: LucideIcon; label: string; description: string; type: "danger"; value?: string; onClick: () => void };

  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleClearAllData = () => {
    localStorage.removeItem("taskflow_tasks");
    window.location.reload();
  };

  const handleExportData = () => {
    const tasks = getTasks();
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taskflow-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadICal = () => {
    const tasks = getTasks();
    downloadICal(tasks, "VibeList");
  };

  const handleCopyWebcal = async () => {
    const tasks = getTasks();
    const encoded = Buffer.from(JSON.stringify(tasks)).toString("base64");
    const url = `${window.location.origin}/api/calendar/feed?tasks=${encoded}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setLastAction("webcal");
    setTimeout(() => { setCopied(false); setLastAction(null); }, 2000);
  };

  const settingsGroups = [
    {
      title: "外觀",
      items: [
        {
          icon: Moon,
          label: "深色模式",
          description: "跟隨系統設定",
          type: "info",
          value: "開發中",
        },
      ],
    },
    {
      title: "通知",
      items: [
        {
          icon: Bell,
          label: "截止提醒",
          description: "任務到期通知",
          type: "info",
          value: "開發中",
        },
      ],
    },
    {
      title: "日曆同步",
      items: [
        {
          icon: CalendarDays,
          label: "下載 iCal 檔案",
          description: "下載 .ics 檔案，匯入 Google Calendar 或 Apple Calendar",
          type: "action",
          onClick: handleDownloadICal,
        } satisfies SettingsItem as SettingsItem,
        {
          icon: Copy,
          label: "複製訂閱連結",
          description: "Webcal URL，複製後在 Google Calendar 訂閱",
          type: "action",
          onClick: handleCopyWebcal,
        } satisfies SettingsItem as SettingsItem,
      ],
    },
    {
      title: "資料",
      items: [
        {
          icon: Download,
          label: "匯出任務",
          description: "JSON 格式下載",
          type: "action",
          onClick: handleExportData,
        } satisfies SettingsItem as SettingsItem,
        {
          icon: Trash2,
          label: "清除所有資料",
          description: "不可逆，資料將被永久刪除",
          type: "danger",
          onClick: () => setShowConfirm(true),
        } satisfies SettingsItem as SettingsItem,
      ],
    },
    {
      title: "關於",
      items: [
        {
          icon: Info,
          label: "版本",
          description: "VibeList v1.0.0",
          type: "info",
          value: "最新",
        },
        {
          icon: Shield,
          label: "隱私權",
          description: "所有資料儲存於本機瀏覽器",
          type: "info",
          value: "本機儲存",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
              <SettingsIcon className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">設定</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {settingsGroups.map((group) => (
          <section key={group.title} aria-labelledby={`settings-${group.title}`}>
            <h2
              id={`settings-${group.title}`}
              className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-3 px-1"
            >
              {group.title}
            </h2>
            <ul className="space-y-1 rounded-xl overflow-hidden" role="list" style={{ border: "1px solid var(--border)" }}>
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                const isLast = idx === group.items.length - 1;
                return (
                  <li key={item.label} className={!isLast ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                    {item.type === "danger" ? (
                      <button
                        onClick={() => (item as { onClick?: () => void }).onClick?.()}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--surface-hover)] transition-colors duration-150"
                        aria-label={item.label}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(255,59,48,0.08)" }}
                        >
                          <Icon className="w-4 h-4" style={{ color: "var(--status-danger)" }} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[var(--status-danger)]">{item.label}</p>
                          <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{item.description}</p>
                        </div>
                      </button>
                    ) : item.type === "action" ? (
                      <button
                        onClick={() => {
                          (item as { onClick?: () => void }).onClick?.();
                        }}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--surface-hover)] transition-colors duration-150"
                        aria-label={item.label}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "var(--brand-tint)" }}
                        >
                          <Icon className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[var(--text-primary)]">{item.label}</p>
                          <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{item.description}</p>
                        </div>
                        {item.label === "下載 iCal 檔案" ? (
                          <span className="text-[12px] font-medium" style={{ color: lastAction === "ical" ? "var(--status-success)" : "var(--brand)" }}>
                            {lastAction === "ical" ? "已下載 ✓" : "執行"}
                          </span>
                        ) : item.label === "複製訂閱連結" ? (
                          <span className="text-[12px] font-medium" style={{ color: lastAction === "webcal" ? "var(--status-success)" : "var(--brand)" }}>
                            {lastAction === "webcal" ? "已複製 ✓" : copied ? "已複製 ✓" : "執行"}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[var(--brand)] font-medium">執行</span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 px-5 py-4">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(0,0,0,0.04)" }}
                        >
                          <Icon className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[var(--text-primary)]">{item.label}</p>
                          <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{item.description}</p>
                        </div>
                        {item.value && (
                          <span className="text-[12px] text-[var(--text-tertiary)] flex-shrink-0">{item.value}</span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>

      {/* 確認對話框 */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-data-title"
        >
          <div
            className="w-full max-w-sm p-6 rounded-2xl"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,59,48,0.08)" }}>
                <Trash2 className="w-5 h-5" style={{ color: "var(--status-danger)" }} aria-hidden="true" />
              </div>
              <h2 id="clear-data-title" className="text-[16px] font-semibold text-[var(--text-primary)]">
                清除所有資料
              </h2>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-6">
              資料刪除後將無法復原。匯出功能可先行保留副本。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleClearAllData}
                className="px-5 py-2.5 rounded-xl text-[14px] font-medium text-white transition-all duration-200"
                style={{ background: "var(--status-danger)" }}
              >
                清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
