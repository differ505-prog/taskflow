/**
 * NotificationsSection — 提醒通知區塊
 *
 * 職責: 系統推播、心流計時器提醒
 * 從 SettingsContext 取 push* state + handlers
 */
"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useSettingsContext } from "./SettingsContext";

interface NotificationsSectionProps {
  notificationPermission: NotificationPermission | "default";
  requestNotificationPermission: () => Promise<boolean>;
}

export function NotificationsSection({
  notificationPermission,
  requestNotificationPermission,
}: NotificationsSectionProps) {
  const {
    pushTestPending,
    setPushTestPending,
    pushBusy,
    setPushBusy,
    pushDbSubscribed,
    setPushDbSubscribed,
    pushSafariHint,
    setPushSafariHint,
    isPwa,
    handleResubscribePush,
    handleUnsubscribePush,
    handleForceResetPush,
    handleTestPush,
  } = useSettingsContext();

  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>提醒通知</h3>
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>系統推播</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>任務到期時收到提醒</p>
          </div>
          {notificationPermission === "granted" ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {pushDbSubscribed === false && (
                  <span
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(255,149,0,0.1)", color: "var(--status-warning)" }}
                    title="瀏覽器有訂閱但雲端資料庫沒有，需要重新訂閱"
                  >
                    <AlertCircle className="w-3 h-3" /> 雲端未同步
                  </span>
                )}
                <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--status-success)" }}>
                  <CheckCircle2 className="w-4 h-4" /> 已授權
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleTestPush()}
                  disabled={pushTestPending}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                >
                  {pushTestPending ? "送出中…" : "測試推播"}
                </button>
                <button
                  onClick={() => void handleResubscribePush()}
                  disabled={pushBusy}
                  title="瀏覽器重新註冊訂閱並把雲端資料庫補上"
                  className="px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
                >
                  {pushBusy ? "處理中…" : "重新訂閱"}
                </button>
                <button
                  onClick={() => void handleUnsubscribePush()}
                  disabled={pushBusy}
                  title="取消瀏覽器推播訂閱"
                  className="p-1.5 rounded-xl text-[12px] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "transparent", color: "var(--text-tertiary)" }}
                  aria-label="取消推播訂閱"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => void handleForceResetPush()}
                disabled={pushBusy}
                title="iOS PWA SW 卡死時的治本按鈕：unregister SW + 清 DB"
                className="text-[10px] underline disabled:opacity-50"
                style={{ color: "var(--text-tertiary)" }}
              >
                推播卡住了？強制重置
              </button>
            </div>
          ) : notificationPermission === "denied" ? (
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--status-danger)" }}>
                <AlertCircle className="w-4 h-4" /> 已拒絕
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                設定 → Safari → 進階 → 網站資料 → 刪除 vercel domain
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={async () => {
                  const ok = await requestNotificationPermission();
                  if (!ok) {
                    const permNow = typeof Notification !== "undefined" ? Notification.permission : "default";
                    setPushSafariHint(
                      permNow === "denied"
                        ? "瀏覽器已封鎖,請到 iOS 設定 → Safari → 進階 → 網站資料 → 刪除此網站再重試"
                        : isPwa
                          ? "瀏覽器已靜默拒絕,請檢查 iOS 設定 → Safari → 進階 → 網站資料"
                          : "Safari 分頁不支援,請將網站加入主畫後再開啟通知",
                    );
                  } else {
                    setPushSafariHint(null);
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-[12px] font-medium"
                style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
              >
                開啟通知
              </button>
              {pushSafariHint && (
                <span className="text-[10px] text-right" style={{ color: "var(--text-tertiary)" }}>
                  {pushSafariHint}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="h-px" style={{ background: "var(--border)" }} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>心流計時器提醒</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>專注時間結束時通知</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked aria-label="心流計時器提醒" />
            <div className="w-11 h-6 rounded-full peer peer-checked:bg-brand bg-black/10 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
      </div>
    </section>
  );
}
