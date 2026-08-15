/**
 * KeyboardShortcutsSection — SettingsPage 內的鍵盤快捷鍵說明區塊
 *
 * 職責: 純靜態顯示，無任何 props / state / callbacks
 * 抽取原因: SettingsPage 資料夾化後，此區塊職責完全獨立
 */
"use client";

import { Keyboard } from "lucide-react";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "快速新增任務", desc: "在任意頁面快速新增任務" },
  { keys: ["⌘", "⇧", "V"], label: "語音建任務", desc: "開啟語音輸入，建立任務至收集箱" },
] as const;

export function KeyboardShortcutsSection() {
  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
        <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
        鍵盤快捷鍵
      </h3>
      <div className="space-y-2">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.label}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: "var(--surface-muted)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-semibold font-mono"
                    style={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      minWidth: "24px",
                      height: "24px",
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
              <div>
                <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {shortcut.label}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {shortcut.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
        <p className="text-[10.5px] px-1" style={{ color: "var(--text-tertiary)" }}>
          Mac 為 ⌘ 鍵，Windows / Linux 為 Ctrl 鍵
        </p>
      </div>
    </section>
  );
}
