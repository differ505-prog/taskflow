/**
 * CalendarSection — 日曆同步區塊
 *
 * 職責: Webcal URL 複製、Google Calendar 加入、.ics 下載、ExternalCalendarSection
 * 從 SettingsContext 取 newCalendarUrl/setNewCalendarUrl/webcalUrlCopied/setWebcalUrlCopied/exportMsg/setExportMsg
 * 從 useExternalCalendar 取 externalCal
 */
"use client";

import { useCallback } from "react";
import { CalendarDays, Copy, CheckCircle2 } from "lucide-react";
import { useSettingsContext } from "./index";
import { useExternalCalendar } from "@/hooks/useExternalCalendar";
import { ExternalCalendarSection } from "@/components/ExternalCalendarSection";
import { downloadICal } from "@/lib/ical";
import { getTasks } from "@/lib/storage";

export function CalendarSection() {
  const {
    newCalendarUrl, setNewCalendarUrl,
    webcalUrlCopied, setWebcalUrlCopied,
    exportMsg, setExportMsg,
  } = useSettingsContext();
  const externalCal = useExternalCalendar();

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
    setTimeout(() => setWebcalUrlCopied(false), 2500);
  }, [getWebcalUrl, setWebcalUrlCopied]);

  const handleOpenWebcalGoogle = useCallback(() => {
    const url = getWebcalUrl();
    window.open(
      `https://calendar.google.com/calendar/r/settings/addcalendar?splash=2&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [getWebcalUrl]);

  const handleDownloadICal = useCallback(() => {
    downloadICal(getTasks(), "VibeList 任務");
    setExportMsg("已下載 .ics 檔案");
    setTimeout(() => setExportMsg(null), 3000);
  }, [setExportMsg]);

  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>
        日曆同步
      </h3>
      <div className="space-y-3">
        {/* Webcal dynamic subscription */}
        <div
          className="p-4 rounded-xl space-y-3"
          style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "color-mix(in srgb, var(--status-success) 10%, transparent)" }}
            >
              <CalendarDays className="w-5 h-5" style={{ color: "var(--status-success)" }} />
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

          {/* URL display + copy */}
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
              onClick={() => void handleCopyWebcalUrl()}
              className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors flex-shrink-0"
              title="複製連結"
            >
              {webcalUrlCopied ? (
                <span className="text-[11px] font-medium" style={{ color: "var(--status-success)" }}>已複製 ✓</span>
              ) : (
                <Copy className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
              )}
            </button>
          </div>

          {/* One-click add buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => void handleOpenWebcalGoogle()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-97"
              style={{ background: "color-mix(in srgb, var(--status-success) 10%, transparent)", color: "var(--status-success)" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-2-8v-4l3 3-3 3v-2H7v-4h3z" fill="currentColor"/>
              </svg>
              加入 Google Calendar
            </button>
            <button
              onClick={() => void handleCopyWebcalUrl()}
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

        {/* Download .ics file */}
        <button
          onClick={() => void handleDownloadICal()}
          className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98 hover:bg-[var(--surface-hover)]"
          style={{ background: "var(--surface-muted)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--brand-tint)" }}
          >
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
        <div
          className="p-4 rounded-xl space-y-3"
          style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
        >
          <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>匯入 Google Calendar 步驟</p>
          <div className="space-y-3">
            {([
              { label: "下載檔案", text: "點擊上方「下載 .ics」按鈕，會下載一個「VibeList 任務.ics」檔案" },
              { label: "打開 Google Calendar", text: "在新分頁打開 ", link: { href: "https://calendar.google.com", label: "Google Calendar" } },
              { label: "匯入日曆", text: "「設定」→「匯入」→「選擇檔案」，上傳剛下載的 .ics" },
              { label: "完成", text: "選取要加入的日曆後點確認。即可在 Google Calendar 看見所有任務" },
              { label: "更新同步", text: "新增或編輯任務後，回來重新下載一次 .ics 檔案即可" },
            ]).map((step, i) => (
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

        {/* External calendar */}
        <ExternalCalendarSection
          externalCal={externalCal}
          newCalendarUrl={newCalendarUrl}
          setNewCalendarUrl={setNewCalendarUrl}
        />
      </div>
    </section>
  );
}
