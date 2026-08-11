"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Settings as SettingsIcon, Trash2, Download, Moon, Bell, Shield, Info, CalendarDays, Copy, Check, ExternalLink, RefreshCw, Plus, type LucideIcon } from "lucide-react";
import { getTasks } from "@/lib/storage";
import { downloadICal } from "@/lib/ical";
import { useExternalCalendar, formatFetchedAgo } from "@/hooks/useExternalCalendar";
import DefaultLaunchViewSection from "@/components/DefaultLaunchViewSection";
import { ExternalCalendarSection } from "@/components/ExternalCalendarSection";
import PageHeader from "@/components/PageHeader";
import { UserMenu } from "@/components/UserMenu";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptionStatus,
} from "@/lib/push/vapid";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type PushState = "loading" | "unsupported" | "denied" | "default" | "subscribed" | "unsubscribed";

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
    isPush?: boolean;
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [calCopied, setCalCopied] = useState(false);

  // ── 外部日曆匯入(§26 邊界 1.1+2.1 衝突指示器)— 與 Modal 版同步 ──
  const externalCal = useExternalCalendar();
  const [newCalendarUrl, setNewCalendarUrl] = useState("");

  // ─── 推播訂閱狀態 (§24.1: 推播設定狀態) ───
  const [pushState, setPushState] = useState<PushState>("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 給 SW 一點時間註冊
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.ready;
        } catch {
          // ignore
        }
      }
      const status = await getPushSubscriptionStatus();
      if (cancelled) return;
      if (!status.supported) {
        setPushState("unsupported");
      } else if (status.subscribed) {
        setPushState("subscribed");
      } else if (status.permission === "denied") {
        setPushState("denied");
      } else {
        setPushState("unsubscribed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      const sub = await subscribeToPush();
      if (!sub) {
        setPushError("瀏覽器拒絕授權或推播不支援");
        setPushState("denied");
        return;
      }

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const deviceLabel = (() => {
        const ua = navigator.userAgent;
        if (/iPhone|iPad/.test(ua)) return "iOS Safari";
        if (/Android/.test(ua)) return "Android Chrome";
        if (/Mac/.test(ua)) return "Mac";
        if (/Windows/.test(ua)) return "Windows";
        return "Unknown";
      })();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          deviceLabel,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setPushError(errBody.error || "訂閱失敗");
        setPushState("unsubscribed");
        return;
      }

      setPushState("subscribed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPushError(msg);
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await unsubscribeFromPush();
        // 通知 server 標記失效
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {
          // 即使 server 沒收到，本地已取消，下次同步會一致
        });
      }
      setPushState("unsubscribed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPushError(msg);
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        setPushError("請先登入");
        return;
      }
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_uid: uid,
          title: "TaskFlow 測試",
          body: "如果你看到這則通知，推播設定成功 ✓",
          url: "/",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPushError(data.error || "測試失敗");
        return;
      }
      if (data.sent === 0) {
        setPushError("已送出但沒有訂閱裝置（試一次「啟用推播」）");
      } else {
        setPushError(`已送到 ${data.sent} 個裝置`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPushError(msg);
    } finally {
      setPushBusy(false);
    }
  };

  const theoryCards = [
    {
      letter: "E",
      name: "艾森豪矩陣",
      color: "var(--brand)",
      bg: "var(--brand-tint)",
      text: "四象限決策框架：Ⅰ重要×緊急→立即做；Ⅱ重要×不緊急→計劃做；Ⅲ不重要×緊急→委派做；Ⅳ不重要×不緊急→刪除。四象限幫助你把精力投入最有價值的事，而非被緊急事務追著跑。",
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
      name: "心流計時器",
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
    // 修 dead URL:舊版指向 /api/calendar/feed?tasks=... 已不存在;改用 /api/calendar/webcal(動態 feed)
    const url = `${window.location.origin}/api/calendar/webcal`;
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
      items: [],
      isPush: true,
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
      {/* Header — 共用 PageHeader(§25 reuse)+ 注入 UserMenu 提供登入/登出入口 + backHref 提供返回首頁入口 */}
      <PageHeader icon={SettingsIcon} title="設定" backHref="/">
        <UserMenu />
      </PageHeader>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 啟動偏好 — 預設啟動畫卷（第一個群組,最高優先） */}
        <DefaultLaunchViewSection />

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

                  {/* ── 匯入外部日曆(read-only 衝突指示)— 與 Modal 版同步(§26 邊界 1.1+2.1)── */}
                  <ExternalCalendarSection
                    externalCal={externalCal}
                    newCalendarUrl={newCalendarUrl}
                    setNewCalendarUrl={setNewCalendarUrl}
                  />
                </div>
              </>
            ) : group.isPush ? (
              <>
                <h2
                  id={`settings-${group.title}`}
                  className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-3 px-1"
                >
                  {group.title}
                </h2>
                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--brand-tint)" }}
                    >
                      <Bell className="w-5 h-5" style={{ color: "var(--brand)" }} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>任務到期推播</p>
                      <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        即使關閉瀏覽器或 PWA 沒開著，任務到時間也會送到你手機 / 電腦的通知中心。
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: "var(--surface-muted)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>推播狀態</p>
                      <p className="text-[14px] font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                        {pushState === "loading" && "讀取中…"}
                        {pushState === "unsupported" && "此瀏覽器不支援推播"}
                        {pushState === "denied" && "已封鎖（請到瀏覽器設定開啟）"}
                        {pushState === "default" && "未授權"}
                        {pushState === "subscribed" && "已啟用 ✓"}
                        {pushState === "unsubscribed" && "未啟用"}
                      </p>
                    </div>
                    {pushState === "subscribed" ? (
                      <Button
                        variant="ghost"
                        onClick={handleDisablePush}
                        disabled={pushBusy}
                        className="disabled:opacity-50"
                        loading={pushBusy}
                      >
                        關閉
                      </Button>
                    ) : (
                      <button
                        onClick={handleEnablePush}
                        disabled={pushBusy || pushState === "unsupported" || pushState === "denied"}
                        className="px-4 py-2 rounded-xl text-[12px] font-medium text-white transition-all active:scale-98 disabled:opacity-50"
                        style={{ background: "var(--brand)" }}
                      >
                        {pushBusy ? "處理中…" : "啟用推播"}
                      </button>
                    )}
                  </div>

                  {pushState === "subscribed" && (
                    <button
                      onClick={handleTestPush}
                      disabled={pushBusy}
                      className="w-full p-3 rounded-xl text-[12px] font-medium transition-all active:scale-98 disabled:opacity-50"
                      style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                    >
                      送一則測試通知
                    </button>
                  )}

                  {pushError && (
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                      {pushError}
                    </p>
                  )}

                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                    💡 iPhone 需 iOS 16.4+ 且把網站「加入主畫面」後才支援背景推播。
                  </p>
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
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>取消</Button>
              <Button variant="danger" onClick={handleClearAllData}>清除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
