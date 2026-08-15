/**
 * ProFeaturesSection — SettingsPage 內的 PRO 功能搶先看區塊
 *
 * 職責: 顯示所有 PRO 幽靈按鈕功能入口
 * 抽取原因: SettingsPage 1599 行，這區塊職責獨立
 */
"use client";

import { Crown, Heart, Package, Palette } from "lucide-react";
import { ProGhostButton } from "@/components/ProGhostButton";
import { GhostButton } from "@/components/GhostButton";
import { useGhostButton } from "@/hooks/useGhostButton";

export function ProFeaturesSection() {
  // §假門測試 B:無限次 AI 粉碎 — 額度用完時切換為幽靈按鈕
  const proThemesGhost = useGhostButton({ buttonId: "pro_themes" });

  return (
    <section>
      <h3 className="text-[12px] font-semibold tracking-tight mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
        <Crown className="w-3.5 h-3.5" aria-hidden="true" />
        PRO 功能搶先看
      </h3>
      <div className="space-y-2">
        {/* Karma Mode */}
        <div className="card px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(244, 63, 94, 0.10)" }}
            >
              <Heart className="w-4 h-4" style={{ color: "#F43F5E" }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Karma Mode</p>
              <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>
                心靈還債引擎 · 拖延會扣信用血條
              </p>
            </div>
          </div>
          <ProGhostButton feature="karma-mode" variant="inline" title="啟用 Karma Mode（PRO 專屬）">
            <span>啟用</span>
          </ProGhostButton>
        </div>

        {/* 加大儲存空間 */}
        <div className="card px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--brand-tint)" }}
            >
              <Package className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>加大儲存空間</p>
              <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>
                ZIP 備份，大檔清理、滿載加購
              </p>
            </div>
          </div>
          <ProGhostButton feature="storage-cleaner" variant="inline" title="管理儲存空間（PRO 專屬）">
            <span>管理</span>
          </ProGhostButton>
        </div>

        {/* §假門測試 C:Pro 版專屬功能 (pro_themes) */}
        <div className="card px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(251, 191, 36, 0.10)" }}
            >
              <Palette className="w-4 h-4" style={{ color: "#fbbf24" }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Pro 版專屬功能</p>
              <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>
                主題客製化 · 深黑模式 · 自訂稱號
              </p>
            </div>
          </div>
          <GhostButton
            onClick={proThemesGhost.handleClick}
            variant="glowing"
            icon={Palette}
            featureId="pro_themes"
            dismissed={proThemesGhost.dismissed}
          >
            解鎖
          </GhostButton>
        </div>
      </div>
    </section>
  );
}
