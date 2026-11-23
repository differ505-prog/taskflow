# Task Board — UI/UX 設計總監驗收儀表板

## 品質評分儀表板 (Round 1)
- **當前輪次**：Round 1 / 4（基準分起算，嚴格扣分制）
- **最新總分**：**7.0 / 10.0**（未達 9.0 門檻 → 退回 `[!]` 修改）
- **五維度明細**：
  1. 視覺克制與色彩質感：**1.4 / 2.0**（`ZenDashboard`、`TaskListItem`、`ErrorBoundary` 硬編碼淺色 Tailwind 色碼或 `dark:`，未對齊 `[data-theme="dark"]` 與 CSS Token；`TaskListItem` 死線徽章底色 `var(--status-danger)15` 為無效 CSS）
  2. 排版層級與網格韻律：**1.5 / 2.0**（`BottomNavigation` 標籤字級混用 `10px` 與 `11px`；`Skeleton` 卡片圓角混用 `rounded-xl`）
  3. 元件工藝與微互動：**1.4 / 2.0**（`BottomNavigation` 禪模式按鈕以 `window.location.href` 觸發整頁重載；`ErrorBoundary` 缺乏卡片層次與恢復按鈕）
  4. 狀態完整與防呆體驗：**1.3 / 2.0**（`AppShellSkeleton` 使用未定義的 `var(--background)`；`TagsPageSkeleton` 卡片底色與背景同為 `--surface-muted`；`Skeleton` 未自動適配深色模式；`ErrorBoundary` 直接傾印紅底堆疊且無重試 CTA）
  5. 響應式與細節打磨：**1.4 / 2.0**（`BottomNavigation` 7 個 `min-w-[64px]` 合計 `448px` 於 `375px` 手機溢出；`AppShellSkeleton` 側欄於手機斷點未隱藏導致橫向破版；`TaskListItem` Checkbox 觸控區小於 `44×44px`；`ZenDashboard` 使用 inline `<svg>` 未統一用 `lucide-react`）

---

## 本輪待修清單 (`[!]`)

- [?] **1. 修復 ZenDashboard 色彩 Token 與統一 Lucide Icon（對齊 light/dark 雙主題）**
  - 檔案：`src/components/ZenDashboard.tsx`
  - 說明：將硬編碼 `bg-slate-50`、`text-slate-*`、`hover:bg-slate-100` 與內聯網格 SVG 改為 `docs/DESIGN_SYSTEM.md` Token 與 `LayoutGrid`。
  - Before -> After：
    ```tsx
    // Before (line 48, 286, 326, 362, 371, 375-390, 417)
    import { Hourglass, Users } from "lucide-react";
    <main className="relative min-h-screen bg-slate-50 px-4 pb-32 pt-10 sm:px-8 sm:pb-28">
    <span className="hidden text-[16px] font-semibold tracking-tight text-slate-700 sm:inline">VibeList</span>
    style={{ background: "rgba(241, 245, 249, 0.5)", border: "none" }}
    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition-all duration-200 ease-out hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 sm:px-4"
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" ...>...</svg>
    className="self-end rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"

    // After
    import { Hourglass, LayoutGrid, Users } from "lucide-react";
    <main className="relative min-h-screen bg-[var(--surface-muted)] text-[var(--text-primary)] px-4 pb-32 pt-10 sm:px-8 sm:pb-28">
    <span className="hidden text-[16px] font-semibold tracking-tight text-[var(--text-primary)] sm:inline">VibeList</span>
    style={{ background: "var(--hover-bg)", border: "none" }}
    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-all duration-200 ease-out hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] sm:px-4"
    <LayoutGrid className="w-4 h-4" aria-hidden="true" />
    className="self-end rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
    ```

- [?] **2. 修復 TaskListItem 主題 Token、無效 CSS 死線底色與 44px 觸控目標**
  - 檔案：`src/components/TaskListItem.tsx`
  - 說明：移除不支援 `data-theme` 的 `dark:*` 寫法，修正 `var(--status-danger)15` 無效 CSS 拼接，並為 Checkbox 補齊 `>= 44×44px` 觸控區。
  - Before -> After：
    ```tsx
    // Before (lines 160-163)
        flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer
        transition-all duration-150 group select-none
        ${isSelected ? "bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40" : "hover:bg-neutral-50 dark:hover:bg-neutral-900/50"}

    // After
        flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer
        transition-all duration-150 group select-none
        ${isSelected ? "bg-[var(--brand-tint)] border border-[var(--brand)]/25" : "hover:bg-[var(--hover-bg)]"}

    // Before (lines 212-216)
      <button
        onClick={handleCheckboxClick}
        className="flex-shrink-0 mt-1 transition-transform hover:scale-110 z-10"
        aria-label={isDone ? "標記未完成" : "標記完成"}
      >

    // After
      <button
        onClick={handleCheckboxClick}
        className="touch-target -ml-2.5 -mt-2 flex-shrink-0 transition-transform hover:scale-110 active:scale-95 z-10"
        aria-label={isDone ? "標記未完成" : "標記完成"}
      >

    // Before (line 246)
                className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all duration-150 active:scale-90"

    // After
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--hover-danger)] hover:text-[var(--status-danger)] transition-all duration-150 active:scale-90"

    // Before (line 271)
            style={{ background: `${deadlineStatus.colorVar}15`, color: deadlineStatus.colorVar }}

    // After
            style={{ background: `color-mix(in srgb, ${deadlineStatus.colorVar} 12%, transparent)`, color: deadlineStatus.colorVar }}
    ```

- [?] **3. 修復 BottomNavigation 手機 375px 寬度溢出、字級不一與整頁重載**
  - 檔案：`src/app/globals.css`、`src/components/BottomNavigation.tsx`
  - 說明：`.bottom-nav-item` 的 `min-width: 64px` 在 7 個項目下會超出 `375px` 螢幕；統一標籤字級為 `10px`，且禪模式改用 `<Link href="/">` 保持 SPA 轉場。
  - Before -> After：
    ```css
    /* Before: src/app/globals.css (lines 727-737) */
    padding: 8px 12px;
    ...
    min-width: 64px;
    min-height: 44px;

    /* After: src/app/globals.css */
    padding: 6px 4px;
    ...
    min-width: 0;
    min-height: 44px;
    ```
    ```tsx
    // Before: src/components/BottomNavigation.tsx (lines 130-142)
          <Timer className="w-[22px] h-[22px]" />
          <span className="text-[11px]">心流</span>
        </button>

        {/* 禪模式 — 手機直接入口 */}
        <button
          className="bottom-nav-item"
          onClick={() => { haptic("selection"); window.location.href = "/"; }}
          aria-label="禪模式"
        >
          <Sparkles className="w-[22px] h-[22px]" />
          <span className="text-[11px]">禪</span>
        </button>

    // After: src/components/BottomNavigation.tsx
          <Timer className="w-[22px] h-[22px]" />
          <span>心流</span>
        </button>

        {/* 禪模式 — 手機直接入口 */}
        <Link
          href="/"
          className="bottom-nav-item"
          onClick={() => haptic("selection")}
          aria-label="禪模式"
        >
          <Sparkles className="w-[22px] h-[22px]" />
          <span>禪</span>
        </Link>
    ```

- [?] **4. 修復 Skeleton 載入態未定義變數、深色自動適配與手機斷點橫向破版**
  - 檔案：`src/app/globals.css`、`src/components/Skeleton.tsx`
  - 說明：將無效的 `var(--background)` 改為 `var(--surface-muted)`，手機斷點隱藏左右側欄骨架，並讓 `.skeleton` 自動響應 `[data-theme="dark"]`。
  - Before -> After：
    ```css
    /* After: src/app/globals.css (append right after .skeleton at line 844) */
    [data-theme="dark"] .skeleton {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.06) 25%,
        rgba(255, 255, 255, 0.10) 50%,
        rgba(255, 255, 255, 0.06) 75%
      );
      background-size: 200% 100%;
    }
    ```
    ```tsx
    // Before: src/components/Skeleton.tsx (lines 44, 49, 85, 112)
      style={{ background: "var(--background)" }}
      <aside className="w-[260px] border-r flex-shrink-0 p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
      <aside className="w-[360px] border-l flex-shrink-0 p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <div key={i} className="p-4 space-y-2 rounded-xl" style={{ background: "var(--surface-muted)" }}>

    // After: src/components/Skeleton.tsx
      style={{ background: "var(--surface-muted)" }}
      <aside className="hidden md:block w-[260px] border-r flex-shrink-0 p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
      <aside className="hidden lg:block w-[360px] border-l flex-shrink-0 p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <div key={i} className="p-4 space-y-2 rounded-lg" style={{ background: "var(--surface)" }}>
    ```

- [?] **5. 重構 ErrorBoundary 錯誤防呆體驗，對齊設計系統並提供恢復動作**
  - 檔案：`src/components/ErrorBoundary.tsx`
  - 說明：取代原始紅底堆疊傾印，改用 `--surface-muted` / `--surface` 卡片、友善中文提示、`.btn-primary` 重新整理按鈕與可折疊除錯細節。
  - Before -> After：
    ```tsx
    // Before: src/components/ErrorBoundary.tsx (lines 32-44)
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-red-50 p-4 overflow-y-auto">
          <h1 className="text-xl font-bold text-red-600 mb-4">Something went wrong.</h1>
          <p className="text-sm font-mono text-red-800 bg-red-100 p-2 rounded whitespace-pre-wrap">
            {this.state.error?.toString()}
          </p>
          <pre className="mt-4 text-xs font-mono text-red-600 bg-red-50 p-2 border border-red-200 overflow-x-auto whitespace-pre-wrap">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    // After: src/components/ErrorBoundary.tsx
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: "var(--surface-muted)", color: "var(--text-primary)" }}
          role="alert"
        >
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="space-y-2">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "var(--status-danger-tint)", color: "var(--status-danger)" }}
              >
                畫面發生異常
              </span>
              <h1 className="text-lg font-semibold text-balance">暫時無法顯示這個畫面</h1>
              <p className="text-sm text-pretty" style={{ color: "var(--text-secondary)" }}>
                資料不會遺失，請重新整理頁面；若問題持續發生，可展開下方錯誤資訊回報。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-primary min-h-[44px]"
              >
                重新載入
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="btn-ghost min-h-[44px]"
              >
                嘗試恢復
              </button>
            </div>
            <details className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              <summary className="cursor-pointer py-1">技術錯誤資訊</summary>
              <pre
                className="mt-2 p-3 rounded-md font-mono overflow-x-auto whitespace-pre-wrap"
                style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
              >
                {this.state.error?.toString()}
                {process.env.NODE_ENV !== "production" && this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    ```
