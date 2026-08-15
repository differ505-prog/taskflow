/**
 * WebhookSection — 自動化整合（Zapier / Make / n8n）區塊
 *
 * 職責: Webhook URL 設定 + 測試
 * 從 SettingsContext 取 webhookDraft/setWebhookDraft/webhookTestMsg/setWebhookTestMsg/webhookSaved/setWebhookSaved
 * 直接使用 useWebhookSettings() + triggerWebhook()（已存在於 lib/useWebhook.ts）
 */
"use client";

import { Zap } from "lucide-react";
import { useSettingsContext } from "./SettingsContext";
import { useWebhookSettings, triggerWebhook } from "@/lib/useWebhook";
import { getTasks } from "@/lib/storage";

export function WebhookSection() {
  const {
    webhookDraft, setWebhookDraft,
    webhookTestMsg, setWebhookTestMsg,
    webhookSaved, setWebhookSaved,
  } = useSettingsContext();

  const webhook = useWebhookSettings();

  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>
        自動化整合
      </h3>
      <div className="space-y-3">
        {/* URL input + actions */}
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

          {/* Status message */}
          {webhookTestMsg && (
            <p
              className="text-[11.5px]"
              style={{ color: webhookSaved ? "var(--status-success)" : "var(--text-secondary)" }}
            >
              {webhookTestMsg}
            </p>
          )}

          {/* §8 security note */}
          <div className="text-[10.5px] leading-relaxed pt-1" style={{ color: "var(--text-tertiary)" }}>
            <strong>資安提醒：</strong> Webhook URL 儲存於本機 localStorage,且 payload 透過瀏覽器直接 POST 到您設定的 endpoint。建議使用 HTTPS endpoint,並定期更換以免外洩。
          </div>
        </div>

        {/* Usage instructions */}
        <div
          className="p-4 rounded-xl space-y-2"
          style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
        >
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
  );
}
