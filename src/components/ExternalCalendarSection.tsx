"use client";

/**
 * ExternalCalendarSection — 外部日曆 (Google / iCloud) 管理區塊
 *
 * §Quick Win #2 (2026-08-04):抽共用 component 消滅 SettingsPage (Modal) 與
 * /(main)/settings (Page) 兩個入口對同一區塊的重複實作。
 *
 * 設計動機(§6 DRY):
 * - Modal 與 Page 兩個 Settings 入口都有「匯入外部日曆」區塊
 * - 原兩版完全相同 137 行 JSX:URL 列表、新增、錯誤、取得連結引導
 * - 抽成單一 component 後 → 改一個 bug 兩邊都修、視覺風格統一保證一致
 *
 * Props 設計:
 * - externalCal:傳入 useExternalCalendar() 回傳值(保持 hook 在外層,符合 React 規則)
 * - newCalendarUrl / setNewCalendarUrl:輸入框 state 由外層持有(避免元件內用 hook)
 * - 這樣是「受控的純展示元件」邏輯,與 Modal/Page 各自的 custom 邏輯解耦
 */

import { ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatFetchedAgo, type ExternalCalendarAPI } from "@/hooks/useExternalCalendar";
import { translateIcsError } from "@/lib/errorMessages";

export interface ExternalCalendarSectionProps {
  externalCal: ExternalCalendarAPI;
  newCalendarUrl: string;
  setNewCalendarUrl: (url: string) => void;
}

export function ExternalCalendarSection({
  externalCal,
  newCalendarUrl,
  setNewCalendarUrl,
}: ExternalCalendarSectionProps) {
  const handleAdd = async () => {
    if (!newCalendarUrl.trim()) return;
    const result = await externalCal.addUrl(newCalendarUrl.trim());
    if (result.ok) {
      setNewCalendarUrl("");
      toast.success(`已加入 ${result.eventCount ?? 0} 個事件`);
    } else {
      toast.error(translateIcsError(new Error(result.error ?? ""), "加入失敗"));
    }
  };

  return (
    <div
      className="p-4 rounded-xl space-y-3"
      style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "color-mix(in srgb, var(--status-success) 10%, transparent)" }}
        >
          <ExternalLink className="w-5 h-5" style={{ color: "var(--status-success)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
            匯入外部日曆(衝突指示)
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            貼上 Google / iCloud 行事曆的私人訂閱網址,VibeList 月曆頁會用灰色圓點標記「那天你有外部行程」
          </p>
        </div>
      </div>

      {/* 已加入的 URL 列表 */}
      {externalCal.urls.length > 0 && (
        <div className="space-y-2">
          {externalCal.urls.map((url) => {
            const eventTotal = Object.values(
              externalCal.perUrlCounts[url] ?? {},
            ).reduce((a, b) => a + b, 0);
            const ago = formatFetchedAgo(externalCal.perUrlFetchedAt[url] ?? null);
            return (
              <div
                key={url}
                className="flex items-center gap-2 p-3 rounded-xl"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] truncate font-mono"
                    style={{ color: "var(--text-secondary)" }}
                    title={url}
                  >
                    {url}
                  </p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {eventTotal} 個事件 · 最後更新 {ago}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => externalCal.removeUrl(url)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                  aria-label="移除此外部日曆"
                  title="移除"
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => void externalCal.refreshAll()}
            disabled={externalCal.loading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-97 disabled:opacity-50"
            style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${externalCal.loading ? "animate-spin" : ""}`} />
            {externalCal.loading ? "拉取中..." : "重新整理全部"}
          </button>
        </div>
      )}

      {/* 新增 URL 輸入 */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={newCalendarUrl}
          onChange={(e) => setNewCalendarUrl(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
          className="input flex-1"
          style={{ fontSize: 14, padding: "8px 12px" }}
          aria-label="外部日曆 ICS 訂閱網址"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={externalCal.loading || !newCalendarUrl.trim()}
          className="px-3 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-97 disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
          style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
          aria-label="加入外部日曆"
        >
          <Plus className="w-3.5 h-3.5" />
          加入
        </button>
      </div>

      {externalCal.error && (
        <p className="text-[11px] px-3 py-2 rounded-xl" style={{ background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }}>
          {externalCal.error}
        </p>
      )}

      {/* iCloud 用戶引導 */}
      <div
        className="p-3 rounded-xl space-y-2"
        style={{ background: "var(--surface-elevated)" }}
      >
        <p className="text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          怎麼取得連結?
        </p>
        <div className="space-y-1.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          <p>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>Google 日曆:</span>
            到 calendar.google.com → 右上齒輪 → 設定 → 左側選你要匯入的日曆 → 整合行事曆 → 私人網址(採用網址)
          </p>
          <p>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>iCloud / Apple:</span>
            最簡單的方式 — 到「設定 → 郵件 → 帳號 → Google」登入並開啟「行事曆同步」,iCloud 的事會自動同步到 Google 日曆,再用上面的方式取得連結。不用單獨處理 iCloud。
          </p>
          <p
            className="pt-1 border-t"
            style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
          >
            連結含個人 token,請勿外流。我們只讀取「哪天有事件」,不儲存事件內容。
          </p>
        </div>
      </div>
    </div>
  );
}
