"use client";

import { Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * PageHeader — 全域頁面 Header 共用元件(§25 reuse)
 *
 * 設計動機:
 * - 多個 page(/settings /stats /tags /waitlist 等)各自維護 Header 結構,容易不一致
 * - 統一「左:icon+標題 / 右:userMenu slot」三段式,跨頁一致
 * - 未來任何 page 只要傳 icon + title + 右上 userMenu,就能拿到統一體驗
 *
 * 用法:
 * <PageHeader icon={SettingsIcon} title="設定">
 *   <UserMenu />
 * </PageHeader>
 *
 * 設計原則(global.mdc):
 * - sticky top-0 z-40 + glass — 跟 settings/page.tsx L160 一致
 * - h-16 — 跟現有 settings header 一致
 * - 極簡 icon:8x8 rounded-xl + var(--brand-tint) — 跟既有風格對齊
 * - max-w-5xl mx-auto — 對齊 settings content 容器寬度
 */
export interface PageHeaderProps {
  /** 左側 icon(Lucide icon) — 預設 ⚙️ Settings */
  icon?: LucideIcon;
  /** 主標題 — 顯示在 icon 右側 */
  title: string;
  /** 右側 userMenu slot — 注入 <UserMenu /> 等互動元件 */
  children?: ReactNode;
  /** 自訂最大寬度(預設 max-w-5xl) */
  maxWidthClass?: string;
}

export default function PageHeader({
  icon: Icon = SettingsIcon,
  title,
  children,
  maxWidthClass = "max-w-5xl",
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 glass">
      <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="flex items-center justify-between gap-3 h-16">
          {/* 左群組:icon + 標題 */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--brand-tint)" }}
            >
              <Icon className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">{title}</h1>
          </div>

          {/* 右群組:userMenu slot(由 page 注入) */}
          {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
      </div>
    </header>
  );
}