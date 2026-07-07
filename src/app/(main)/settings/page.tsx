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

  type SettingsGroup = {
    title: string;
    items: SettingsItem[];
    isTheory?: boolean;
    isCalendar?: boolean;
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [calCopied, setCalCopied] = useState(false);

  const theoryCards = [
    {
      letter: "E",
      name: "艾森豪矩陣",
      color: "var(--brand)",
      bg: "var(--brand-tint)",
      text: "區分「重要」與「緊急」，用高 / 中 / 低三級優先級減少決策疲勞。任務依優先級自動排序，確保你永遠先做最有價值的事。",
    },
    {
      letter: "G",
      name: "GTD 時間管理法",
      color: "var(--brand)",
      bg: "var(--brand-tint)",
      text: "收集箱用來清空大腦工作記憶，降低認知負載。「今天」與「未來 7 天」視圖將龐大待辦清單化為可執行的下一步行動。",
    },
    {
      letter: "P",
      name: "番茄工作法",
      color: "var(--status-warning)",
      bg: "rgba(255,149,0,0.1)",
      text: "25 分鐘高度專注工作區塊，配合短休息形成心流節奏。內建計時器讓你不必切換工具，專注當下最重要的事。",
    },
  ];

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
    setCalCopied(true);
    setTimeout(() => { setCopied(false); setLastAction(null); setCalCopied(false); }, 2500);
  };

  const settingsGroups: SettingsGroup[] = [
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
      items: [],
      isCalendar: true,
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
      title: "理論基石",
      items: [],
      isTheory: true,
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
            {group.isTheory ? (
              <>
                <h2
                  id={`settings-${group.title}`}
                  className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-3 px-1"
                >
                  {group.title}
                </h2>
                <div className="space-y-3">
                  {theoryCards.map((card) => (
                    <div
                      key={card.letter}
                      className="p-4 rounded-xl"
                      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: card.bg }}
                        >
                          <span className="text-[13px] font-bold" style={{ color: card.color }}>{card.letter}</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{card.name}</p>
                          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{card.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : group.isCalendar ? (
              <>
                <h2
                  id={`settings-${group.title}`}
                  className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-3 px-1"
                >
                  {group.title}
                </h2>
                <div className="space-y-3">
                  <button
                    onClick={handleCopyWebcal}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all active:scale-98 hover:bg-[var(--surface-hover)]"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-tint)" }}>
                      <Copy className="w-5 h-5" style={{ color: "var(--brand)" }} />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>複製日曆訂閱連結</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        貼到 Google Calendar 訂閱，有變動時重新複製即可
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
                  <div className="p-4 rounded-xl space-y-2" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                    <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>使用方式</p>
                    <ol className="space-y-1.5">
                      {[
                        "點擊「複製連結」",
                        "Google Calendar → 左側「加入其他日曆」→「從網址加入」",
                        "貼上後確認訂閱即可",
                        "日曆顯示目前所有任務，任務有變動時重新複製一次即可刷新",
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 text-[10px] font-bold" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
