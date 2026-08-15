/**
 * InteractionSection — 互動體驗區塊
 *
 * 職責: 完成任務慶祝動畫開關
 * 從 SettingsContext 取 confettiEnabled
 */
"use client";

import { useSettingsContext } from "./SettingsContext";
import { getConfettiEnabled, setConfettiEnabled, previewConfetti } from "@/lib/confetti";

export function InteractionSection() {
  const { confettiEnabled, setConfettiEnabledState } = useSettingsContext();

  const handleConfettiToggle = (enabled: boolean) => {
    setConfettiEnabledState(enabled);
    setConfettiEnabled(enabled);
  };

  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>
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
              onClick={() => previewConfetti()}
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
  );
}
