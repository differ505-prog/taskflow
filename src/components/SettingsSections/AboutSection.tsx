/**
 * AboutSection — SettingsPage 內的理論基礎說明區塊
 *
 * 職責: 純靜態顯示，無任何 props / state / callbacks
 * 抽取原因: SettingsPage 資料夾化後，此區塊職責完全獨立
 */
export function AboutSection() {
  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>
        理論基礎
      </h3>
      <div className="space-y-3">
        <div
          className="p-4 rounded-xl border"
          style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "var(--brand-tint)" }}
            >
              <span className="text-[13px] font-bold" style={{ color: "var(--brand)" }}>E</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>艾森豪矩陣</p>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                四象限決策框架：Ⅰ重要×緊急→立即做；Ⅱ重要×不緊急→計劃做；
                Ⅲ不重要×緊急→委派做；Ⅳ不重要×不緊急→刪除。把精力投入最有價值的事，而非被緊急事務追著跑。
              </p>
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "var(--brand-tint)" }}
            >
              <span className="text-[13px] font-bold" style={{ color: "var(--brand)" }}>G</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>GTD 時間管理法</p>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                收集箱用來清空大腦工作記憶，降低認知負載。
                「今天」與「未來 7 天」視圖將龐大待辦清單化為可執行的下一步行動。
              </p>
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "rgba(255,149,0,0.1)" }}
            >
              <span className="text-[13px] font-bold" style={{ color: "var(--status-warning)" }}>P</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>心流計時器</p>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                25 分鐘高度專注工作區塊，配合短休息形成心流節奏。
                內建計時器讓你不必切換工具，專注當下最重要的事。
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 px-1">
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            VibeList v0.2.0 · 本地端儲存 · 隱私優先
          </p>
        </div>
      </div>
    </section>
  );
}
