"use client";

import { useUserPreferences, type DefaultView } from "@/hooks/useUserPreferences";
import { Compass, Sparkles, Check } from "lucide-react";

/**
 * DefaultLaunchViewSection — 預設啟動畫卷設定
 *
 * 品牌承諾「真實與脆弱」(global.mdc)：
 * - 不跳紅色警告對話框(對齊 anti-pattern §3)
 * - 用極淡的灰色描述給 ADHD 用戶溫柔的提醒
 * - 預設值 = "zen"(對齊 anti-pattern §2)
 * - 不加多餘選項(對齊 anti-pattern §1)
 *
 * 互動:
 * - 點卡片即切換(無 confirm modal,無警告對話框)
 * - 切換後立刻寫 localStorage + 觸發 UI 重組
 */
export default function DefaultLaunchViewSection() {
  const { defaultView, setDefaultView, isHydrated } = useUserPreferences();

  const options: Array<{
    value: DefaultView;
    icon: typeof Sparkles;
    label: string;
    hint: string;
    description: string;
  }> = [
    {
      value: "zen",
      icon: Sparkles,
      label: "禪模式",
      hint: "（預設）",
      description: "專注今日，防禦干擾",
    },
    {
      value: "board",
      icon: Compass,
      label: "任務大廳",
      hint: "",
      description: "全局規劃，戰略總覽",
    },
  ];

  return (
    <section aria-labelledby="settings-default-launch-view">
      <h2
        id="settings-default-launch-view"
        className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-3 px-1"
      >
        啟動偏好
      </h2>

      <div
        className="p-5 rounded-xl mb-3"
        style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          預設啟動畫卷
        </h3>
        <p className="text-[12px] leading-relaxed mb-4" style={{ color: "var(--text-tertiary)" }}>
          選擇登入時第一眼看見的畫面。如果你容易感到焦慮，強烈建議保持預設的「禪模式」。
        </p>

        {/* 切換卡片（兩選一） */}
        <div className="space-y-2" role="radiogroup" aria-label="預設啟動畫卷">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = defaultView === opt.value;
            // SSR 期間保持穩定(避免 hydration mismatch)— 顯示預設狀態
            const showAsSelected = isHydrated ? isSelected : opt.value === "zen";
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={showAsSelected}
                onClick={() => setDefaultView(opt.value)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background: showAsSelected ? "var(--brand-tint)" : "var(--surface-elevated)",
                  border: `1px solid ${showAsSelected ? "var(--brand)" : "var(--border)"}`,
                  boxShadow: showAsSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: showAsSelected ? "var(--brand)" : "var(--surface-muted)",
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: showAsSelected ? "white" : "var(--text-tertiary)" }}
                    aria-hidden
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[14px] font-medium"
                    style={{ color: showAsSelected ? "var(--brand)" : "var(--text-primary)" }}
                  >
                    {opt.label}
                    {opt.hint && (
                      <span
                        className="ml-2 text-[12px] font-normal"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {opt.hint}
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {opt.description}
                  </p>
                </div>
                {showAsSelected && (
                  <Check
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: "var(--brand)" }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}