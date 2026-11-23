# VibeList (TaskFlow) Design System Specification

> **Source of Truth**: Extracted from [`tailwind.config.ts`](../tailwind.config.ts), [`src/app/globals.css`](../src/app/globals.css), [`src/app/layout.tsx`](../src/app/layout.tsx), and [`src/lib/theme.ts`](../src/lib/theme.ts).
> **Theme Switching**: Controlled via `<html data-theme="dark">` (storage key `taskflow_theme`: `"light" | "dark" | "system"`).

---

## 1. 色彩系統 (Color Tokens & 60/30/10 Rule)

遵循「色彩紀律鎖定」原則，避免高飽和刺眼色塊與廉價漸層。頁面視覺比例維持 **60% 表面背景 / 30% 卡片與文字層次 / 10% 品牌與狀態強調**。

### 1.1 表面與邊框 (Surfaces & Borders)

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) | Tailwind Class | 用途 |
| :--- | :--- | :--- | :--- | :--- |
| `--surface-muted` | `#F3F2EE` | `#141416` | `bg-surface-muted` | 頁面底色（溫暖米灰 / 深炭） |
| `--surface` | `#FFFFFF` | `#1C1C1E` | `bg-surface` | 卡片、輸入框、底部導覽底色 |
| `--surface-elevated` | `#FFFFFF` | `#2C2C2E` | `bg-surface-elevated` | 彈窗、浮層元件 |
| `--surface-hover` | `#EAE9E5` | `#2C2C2E` | — | 元件懸停底色 |
| `--surface-sidebar` | `#F3F2EE` | `#1A1A1C` | — | 側邊欄背景 |
| `--hover-bg` | `rgba(0, 0, 0, 0.05)` | `rgba(255, 255, 255, 0.08)` | — | Ghost 按鈕與列表項目 Hover |
| `--border` | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.08)` | — | `.divider` 與極細分隔線 |
| `--border-hover` | `rgba(0, 0, 0, 0.14)` | `rgba(255, 255, 255, 0.16)` | — | 卡片與邊框懸停態 |

> 全域 `* { border-color: transparent; }`，優先以**留白與表面層次**分隔區塊，僅在表單控制項與 `.divider` 使用極細邊框。

### 1.2 品牌與強調色 (Brand & Zen Accents)

| Token | Light | Dark | 用途 |
| :--- | :--- | :--- | :--- |
| `--brand` | `#5E74D6` | `#8BA4FF` | Primary CTA、`focus-visible` 外框、活躍導覽 |
| `--brand-hover` | `#4D5FC0` | `#A0B5FF` | `.btn-primary:hover` |
| `--brand-foreground` | `#ffffff` | `#ffffff` | 品牌底色上的文字 |
| `--brand-tint` | `rgba(79, 106, 245, 0.10)` | `rgba(107, 138, 255, 0.12)` | `.pill`、`.voice-indicator` 輕量底色 |
| `--tag-default` | `#4F6AF5` | `#6B8AFF` | 標籤預設色（搭配 `--tag-default-tint`） |
| `--accent-warm-start` | `#7BA8F5` | `#A8C4FA` | 禪模式 `.btn-primary-zen`、`.fab-zen` 起色 |
| `--accent-warm-end` | `#5E8FE8` | `#93B8F8` | 禪模式 Hover 與呼吸光暈收尾色 |
| `--chip-accent-bg` / `text` | `rgba(123 168 245 / 0.12)` / `#7BA8F5` | `rgba(123 168 245 / 0.15)` / `#A8C4FA` | 日期預覽 Chip |

### 1.3 文字灰階 (Typography Hierarchy)

| Token | Light | Dark | 用途 |
| :--- | :--- | :--- | :--- |
| `--text-primary` | `#1C1C1E` | `#F5F5F7` | 主標題、任務標題、內文 |
| `--text-secondary` | `#636366` | `#AEAEB2` | 次要內文、Ghost 按鈕、標籤文字 |
| `--text-tertiary` | `#AEAEB2` | `#636366` | `.text-meta`、時間戳、輔助說明 |
| `--text-placeholder` | `#C7C7CC` | `#48484A` | Input placeholder |

### 1.4 語意與四象限優先級色 (Status & Eisenhower Priority)

| Token | Light | Dark | 用途 |
| :--- | :--- | :--- | :--- |
| `--status-success` | `#34C759` | `#86EFAC` | 完成狀態、成功回饋（Tint：`--status-success-tint`） |
| `--status-warning` | `#FF9500` | `#FDBA74` | 警告提醒（Tint：`--status-warning-tint`） |
| `--status-danger` | `#FF3B30` | `#FCA5A5` | 危險刪除、錯誤框線（Tint：`--status-danger-tint`） |
| `--priority-do-now` | `#D70015` | `#FF4D4D` | 重要且緊急 (Q1) |
| `--priority-schedule` | `#F97316` | `#FF9244` | 重要不緊急 (Q2) |
| `--priority-delegate` | `#EAB308` | `#FFD93D` | 緊急不重要 (Q3) |
| `--priority-none` | `#9CA3AF` | `#9CA3AF` | 無優先級 / 一般 |

---

## 2. 排版與字級系統 (Typography)

- **字體家族**：`font-sans` 對應 `var(--font-sans), system-ui, sans-serif`（於 `layout.tsx` 載入 Google Font `Inter`）。
- **抗鋸齒與排版優化**：全域啟用 `-webkit-font-smoothing: antialiased`、`-moz-osx-font-smoothing: grayscale`、`text-rendering: optimizeLegibility`。
- **中文間距微調**：`:lang(zh), :lang(zh-Hans), :lang(zh-Hant)` 套用 `letter-spacing: -0.02em`，其餘預設 `-0.01em`。
- **換行工具類**：標題使用 `.text-balance` (`text-wrap: balance`)，段落使用 `.text-pretty` (`text-wrap: pretty`)，單行使用 `.truncate`。

| 層級 | 字級 (`font-size`) | 字重 (`font-weight`) | 行高 (`line-height`) | 代表元件 |
| :--- | :--- | :--- | :--- | :--- |
| Body 基準 | `15px` | `400` | `1.5` | `body`、`.input` |
| 按鈕 / 操作標籤 | `14px` | `500` | `1.4` | `.btn-primary`、`.btn-ghost`、`.btn-outlined` |
| Chip / Pill / Meta | `12px` | `500` (Meta `400`) | `1.4` | `.pill`、`.pill-muted`、`.tag-chip`、`.text-meta` |
| 滑動操作標籤 | `11px` | `600` | `1.2` | `.swipe-action` |
| 底部導覽 / 徽章 | `10px` / `9px` | `500` / `700` | `1` | `.bottom-nav-item` / `.bottom-nav-badge` |

---

## 3. 圓角、陰影與毛玻璃 (Radius, Shadows & Glass)

### 3.1 圓角規範 (Border Radius)

Tailwind 與 CSS Token 嚴格一致，禁止任意混用非標準圓角：

| CSS Token | Tailwind Class | 數值 | 適用元件 |
| :--- | :--- | :--- | :--- |
| `--radius-sm` | `rounded` / `rounded-sm` | `8px` | `.skeleton`、小型內嵌項目 |
| `--radius-md` | `rounded-md` | `12px` | `.btn-*`、`.input`、`.bottom-nav-item` |
| `--radius-lg` | `rounded-lg` | `16px` | `.card`（標準任務卡片 / 面板） |
| `--radius-xl` | `rounded-xl` | `20px` | 大型對話框 / Sheet 容器 |
| `--radius-full` | `rounded-full` | `9999px` | `.pill`、`.tag-chip`、`.fab`、`.voice-indicator` |

### 3.2 陰影與毛玻璃 (Shadows & Glassmorphism)

- **CSS 陰影階梯**：`--shadow-xs` (`0 1px 2px`) → `--shadow-sm` (`0 1px 3px`) → `--shadow-md` (`0 2px 6px`) → `--shadow-lg` (`0 4px 16px`) → `--shadow-hover` (`0 4px 12px`)，Dark mode 自動提高不透明度。
- **Tailwind 擴充陰影**：`shadow-soft-sm`、`shadow-soft-md`、`shadow-soft-lg`、`shadow-glass`（搭配 `backdrop-blur-glass` `16px`）。
- **毛玻璃標頭 (`.glass`)**：`rgba(255,255,255,0.82)`（Dark: `rgba(28,28,30,0.82)`）+ `backdrop-filter: blur(20px) saturate(180%)`。

---

## 4. 間距、觸控與響應式規範 (Spacing & Responsive)

### 4.1 4px / 8px 韻律基準
- 元件內距與間隙遵循 `4px` / `8px` 倍數（例外：`padding: 10px 20px` CTA、`10px 14px` Input、`3px 10px` Pill）。
- **Icon 規範**：全站統一使用 **`lucide-react`**（避免混用其他圖示庫），維持線條粗細與尺寸一致。

### 4.2 觸控與行動端安全區 (Mobile & Touch Safety)
- **最小點擊區域**：所有互動按鈕須滿足 `>= 44×44px`（可用 `.touch-target` 強制保障）；`.bottom-nav-item` 最低 `64×44px`，`.fab` / `.fab-zen` 固定 `56×56px`。
- **Safe Area**：固定頂部／底部容器須套用 `.safe-top`、`.safe-bottom` 或偽元素 `.safe-area-top`、`.safe-area-bottom`（預留 `env(safe-area-inset-*)`）。
- **導覽與抽屜斷點**：
  - `.bottom-nav` 高度 `calc(60px + env(safe-area-inset-bottom, 0px))`。
  - `.fab` 位於 `bottom: calc(140px + env(safe-area-inset-bottom, 0px))`、`right: 20px`，避開底部導覽列。
  - `.mobile-sidebar` 寬度 `min(300px, 85vw)`；第三方懸浮元件於 `<768px` 置左、於 `md (>=768px)` 置右 `bottom: 60px`。
  - `body` 強制 `overflow-x: hidden` 杜絕手機版橫向捲軸；非輸入框停用 `-webkit-tap-highlight-color` 與非預期 `user-select`。

---

## 5. 元件狀態、微互動與無障礙 (Components & Motion)

### 5.1 預設過渡曲線
- **標準過渡**：`200ms cubic-bezier(0.4, 0, 0.2, 1)`（Tailwind `duration` / `ease` 預設值）。
- **彈性微互動**：Hover 上浮 / 按壓彈回使用 `cubic-bezier(0.34, 1.56, 0.64, 1)`（如 `.btn-primary`、`200ms`；`.focus-card-hover`、`300ms`）。

### 5.2 必備互動與狀態回饋
1. **Hover / Active / Focus**：
   - `.btn-primary`：Hover `translateY(-1px)` + 品牌陰影；Active `scale(0.97)`；Disabled `opacity: 0.45`。
   - `.press-effect`：觸控按壓 `scale(0.96)` + `opacity: 0.88`（`100ms ease`）。
   - `:focus-visible`：強制 `outline: 2px solid var(--brand); outline-offset: 2px`。
2. **Loading 載入態**：使用 `.spinner`（20px 品牌色旋轉環）或 `.skeleton` / `.skeleton-dark`（`skeleton-shimmer` 1.4s 流動骨架屏），禁止白屏等待。
3. **Error 與 Empty 狀態**：表單驗證錯誤套用 `.input-error`（`--status-danger` 邊框 + 10% 外光暈）；空狀態須提供清晰引導與操作入口（如禪模式 `zen-glow` 呼吸動畫）。
4. **禪模式與專注微互動**：`.focus-card-breathe`（4s 呼吸光暈）、`.focus-complete-ripple`（700ms 完成漣漪）、`.inbox-active-glow`（2.4s 收件匣脈動）。
5. **動態減弱 (Reduced Motion)**：持續性呼吸/脈動動畫須在 `@media (prefers-reduced-motion: reduce)` 中停用 `animation: none`。
