# Task Board — UI/UX 設計總監驗收儀表板

## 品質評分儀表板 (Round 2 → Round 3)
- **當前輪次**：Round 3 / 4（Round 1 五項已驗收並歸檔至 `docs/task-archive.md`；Round 2 三項已修，待複驗）
- **最新總分**：**8.5 / 10.0**（Round 2 複驗前基準；本輪三項已修完，狀態標 `[?]` 待 UI/UX 總監複驗）
- **五維度明細（Round 2 基準）**：
  1. 視覺克制與色彩質感：**1.7 / 2.0**（`ZenDashboard` 空狀態引用未定義 `--accent-warm`；`MorePopover` 殘留 `hover:bg-red-50` 與 `dark:hover:bg-white/10`）
  2. 排版層級與網格韻律：**1.8 / 2.0**（`ZenDashboard` 卡片圓角混用 `rounded-3xl`/`rounded-2xl` 需對齊設計規範；`跳過` 按鈕缺少明確靜態文字色 Token）
  3. 元件工藝與微互動：**1.7 / 2.0**（`ZenDashboard` 空狀態「開啟任務大廳」用 `<a>` 硬跳轉；`MorePopover` 「標籤/統計/設定」缺少一致 hover 底色回饋）
  4. 狀態完整與防呆體驗：**1.7 / 2.0**（達標：`Skeleton` 與 `ErrorBoundary` 狀態完整）
  5. 響應式與細節打磨：**1.6 / 2.0**（`ZenDashboard` `跳過` 按鈕不足 44px 觸控高度；`ZenDashboard` 與 `BottomNavigation` 仍有 3 處手寫 SVG 及圖示語意重複）

### 本輪修畢摘要（Round 2 → 待複驗）
- `[?]` 1：`--accent-warm` → `--accent-warm-start`；CTA 改 `<Link>`；`ChevronRight`/`GripVertical`/`Sparkles`/`Zap` 改用 Lucide，刪除手寫 `GripIcon`/`ChevronRightIcon`；`跳過` 按鈕補 `min-h-[44px]` + `var(--text-tertiary)` + `var(--hover-bg)`
- `[?]` 2：`MoreIcon` → `MoreHorizontal`；`habits` 改 `Flame`、`stats` 改 `BarChart3`；移除 `hover:bg-black/5 dark:hover:bg-white/10` 與 `hover:bg-red-50`，改用 `var(--hover-bg)` / `var(--surface-hover)` / `var(--hover-danger)`
- `[?]` 3：圓角收斂為設計系統尺度（`rounded-3xl`→`rounded-xl`、`rounded-2xl`→`rounded-lg`）

### Build Gate 結果
- `npx tsc --noEmit` → exit 0（clean）
- `npx vitest run` → 19 files / 188 tests 全數通過
- `npm run build` → exit 0（success）

---

## 本輪待修清單 (`[?]` 待複驗)

- [?] **1. 修復 ZenDashboard 未定義變數 `--accent-warm`、SPA `<Link>` 與統一 Lucide Icon / 44px 觸控**
  - 檔案：`src/components/ZenDashboard.tsx`
  - 說明：補齊 `ChevronRight`, `GripVertical`, `Zap`（或 `Sparkles`）自 `lucide-react` 匯入並移除手寫 SVG；修正 `--accent-warm` 為 `--accent-warm-start`；空狀態 CTA 改 `<Link>`；「跳過」按鈕補齊 `var(--text-tertiary)` 與 `min-h-[44px]`；移除多餘自訂 `GripIcon` / `ChevronRightIcon`。
  - Before -> After：
    ```tsx
    // Before (line 48)
    import { Hourglass, LayoutGrid, Users } from "lucide-react";
    // After
    import { ChevronRight, GripVertical, Hourglass, LayoutGrid, Users, Zap } from "lucide-react";

    // Before (line 742-750)
        <button
          type="button"
          onClick={onSkip}
          disabled={isSlashing || isCrashing || isEditing}
          className="text-sm transition-colors hover:text-[var(--accent-warm-end)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="跳過此任務 — 區間任務推遲一天、單日任務退回收集箱"
        >
          跳過
        </button>
    // After
        <button
          type="button"
          onClick={onSkip}
          disabled={isSlashing || isCrashing || isEditing}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-sm text-[var(--text-tertiary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--accent-warm-end)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="跳過此任務 — 區間任務推遲一天、單日任務退回收集箱"
        >
          跳過
        </button>

    // Before (line 724 & 781)
          <ChevronRightIcon />
          ...
          <GripIcon />
    // After
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          ...
          <GripVertical className="w-4 h-4" aria-hidden="true" />

    // Before (line 828 & 847-856)
          className="relative text-[var(--accent-warm)]"
      ...
      <a
        href="/?board=1"
        className="mt-1 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
        style={{
          backgroundImage: "linear-gradient(135deg, var(--accent-warm-start), var(--accent-warm-end))",
        }}
      >
        <span aria-hidden>⚡</span>
        <span>開啟任務大廳</span>
      </a>
    // After
          className="relative text-[var(--accent-warm-start)]"
      ...
      <Link
        href="/?board=1"
        className="mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
        style={{
          backgroundImage: "linear-gradient(135deg, var(--accent-warm-start), var(--accent-warm-end))",
        }}
      >
        <Zap className="w-4 h-4" aria-hidden="true" />
        <span>開啟任務大廳</span>
      </Link>
    ```
    （同步移除 `ZenDashboard.tsx` 底部不再使用的 `GripIcon` 與 `ChevronRightIcon` 函式。）

- [?] **2. 統一 BottomNavigation `MorePopover` 深色模式 Token、Hover 回饋與 Lucide 圖示**
  - 檔案：`src/components/BottomNavigation.tsx`
  - 說明：用 `MoreHorizontal` 取代手寫 `MoreIcon`；「習慣」改用已匯入的 `Flame` 避免與「統計」的 `BarChart3` 撞圖示；修補 `MorePopover` 內遺漏的 `hover:bg-[var(--surface-hover)]`、`hover:bg-[var(--hover-bg)]` 與 `hover:bg-[var(--hover-danger)]`。
  - Before -> After：
    ```tsx
    // Before (line 5-8, 30-33, 153, 183-191)
    import {
      Inbox, Sun, CalendarDays, Layers, Tag, BarChart3, CalendarRange,
      Settings, List as LucideList, Timer, Sparkles, Flame, LogOut, MoreVertical
    } from "lucide-react";
    const MORE_ITEMS: BottomNavItem[] = [
      { view: "habits", label: "習慣", icon: <BarChart3 className="w-[22px] h-[22px]" /> },
      { view: "tags", label: "標籤", icon: <Tag className="w-[22px] h-[22px]" /> },
      { view: "stats", label: "統計", icon: <Layers className="w-[22px] h-[22px]" /> },
    ];
    <MoreIcon />
    // After
    import {
      Inbox, Sun, CalendarDays, Layers, Tag, BarChart3,
      Settings, Timer, Sparkles, Flame, LogOut, MoreVertical, MoreHorizontal
    } from "lucide-react";
    const MORE_ITEMS: BottomNavItem[] = [
      { view: "habits", label: "習慣", icon: <Flame className="w-[22px] h-[22px]" /> },
      { view: "tags", label: "標籤", icon: <Tag className="w-[22px] h-[22px]" /> },
      { view: "stats", label: "統計", icon: <BarChart3 className="w-[22px] h-[22px]" /> },
    ];
    <MoreHorizontal className="w-[22px] h-[22px]" aria-hidden="true" />
    // （並移除多餘的 MoreIcon 函式定義）

    // Before (lines 298, 331, 342, 352)
    className="flex-shrink-0 mr-2 p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
    ...
    className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors"
    ...
    className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left"
    ...
    className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors hover:bg-red-50"
    // After
    className="flex-shrink-0 mr-2 p-2 rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
    ...
    className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors hover:bg-[var(--surface-hover)]"
    ...
    className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors hover:bg-[var(--surface-hover)]"
    ...
    className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors hover:bg-[var(--hover-danger)]"
    ```

- [?] **3. 統一 ZenDashboard 卡片圓角尺度至設計系統 `--radius-lg` / `--radius-xl`**
  - 檔案：`src/components/ZenDashboard.tsx`
  - 說明：對照 `docs/DESIGN_SYSTEM.md`（卡片 `rounded-lg` `16px`、大型面板 `rounded-xl` `20px`），將 `FocusCard` 與 `EmptyState` 的 `rounded-3xl` 收斂為 `rounded-xl` (`20px`)、`SortableQueueItem` 與 `QueueItemCard` 的 `rounded-2xl` 收斂為 `rounded-lg` (`16px`)。
  - Before -> After：
    ```tsx
    // Before (lines 650, 770, 791, 800)
    className="focus-card-breathe focus-card-hover group relative w-full rounded-3xl ..."
    className={`flex items-center gap-3 rounded-2xl ...`}
    className={`flex-1 truncate ... ${isDragging ? "rounded-2xl ..."`}
    <div className="flex flex-col items-center gap-4 rounded-3xl ...">

    // After
    className="focus-card-breathe focus-card-hover group relative w-full rounded-xl ..."
    className={`flex items-center gap-3 rounded-lg ...`}
    className={`flex-1 truncate ... ${isDragging ? "rounded-lg ..."`}
    <div className="flex flex-col items-center gap-4 rounded-xl ...">
    ```
