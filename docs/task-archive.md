# Task Archive

## Round 1 已驗收歸檔（2026-11-23｜Round 1: 7.0 -> Round 2 驗收通過）
- [x] **1. 修復 ZenDashboard 色彩 Token 與統一 Lucide Icon（對齊 light/dark 雙主題）**（`src/components/ZenDashboard.tsx`）
- [x] **2. 修復 TaskListItem 主題 Token、無效 CSS 死線底色與 44px 觸控目標**（`src/components/TaskListItem.tsx`）
- [x] **3. 修復 BottomNavigation 手機 375px 寬度溢出、字級不一與整頁重載**（`src/app/globals.css`、`src/components/BottomNavigation.tsx`）
- [x] **4. 修復 Skeleton 載入態未定義變數、深色自動適配與手機斷點橫向破版**（`src/app/globals.css`、`src/components/Skeleton.tsx`）
- [x] **5. 重構 ErrorBoundary 錯誤防呆體驗，對齊設計系統並提供恢復動作**（`src/components/ErrorBoundary.tsx`）

## Round 2 已驗收歸檔（2026-11-23｜Round 2: 8.5 -> Round 3 驗收通過 9.3 / 10.0）
- [x] **1. 修復 ZenDashboard 未定義變數 `--accent-warm`、SPA `<Link>` 與統一 Lucide Icon / 44px 觸控**（`src/components/ZenDashboard.tsx`）
- [x] **2. 統一 BottomNavigation `MorePopover` 深色模式 Token、Hover 回饋與 Lucide 圖示**（`src/components/BottomNavigation.tsx`）
- [x] **3. 統一 ZenDashboard 卡片圓角尺度至設計系統 `--radius-lg` / `--radius-xl`**（`src/components/ZenDashboard.tsx`）

## 高回報複利習慣系統 已驗收歸檔（2026-11-25｜Round 1: 7.6 -> Round 2 驗收通過 9.2 / 10.0）
- [x] **T1. 建立 `compoundHabitPlan.ts` 1-Slot 實驗鎖與復盤筆記純函式**（`src/lib/compoundHabitPlan.ts`）
- [x] **T2. 補齊 `compoundHabitPlan.test.ts` 11 項單元測試**（`src/__tests__/compoundHabitPlan.test.ts`）
- [x] **T3. 開放 `HabitCheckin.note` 微型復盤筆記 UI 與保留草稿修正**（`src/components/HabitsPage.tsx`）
- [x] **T4. 新增 `CompoundExperimentPickerModal` 單一實驗挑選器與 44px / Token 打磨**（`src/components/CompoundExperimentPickerModal.tsx`）
- [x] **T5. 修復 `TodayWrapUpButton` 卸載競態並打通 `WrapUpReflectionSheet` 睡前復盤**（`src/components/TodayWrapUpButton.tsx`、`src/components/WrapUpReflectionSheet.tsx`）
- [x] **T6. 新增 Q3/Q4「勇敢說不」注意力防線與手機 44px 熱區**（`src/hooks/useDeclineTask.ts`、`src/components/TaskDetailPanel.tsx`、`src/components/TaskListItem.tsx`、`src/components/AppShell.tsx`）
- [x] **T7. Build Gate 驗收：`tsc` exit 0、`vitest` 20 files / 199 tests passed、`next build` exit 0**
- [x] **A1–A4. 個人帳號 API 設定寫入 `supabase_cloud`（`plan-compound-12`：週日主題日 + 1 每日主實驗 + 3 低頻週期任務）**

## 計畫 3.1 框架升級 ＋ 習慣預約休眠 已驗收歸檔（2026-11-26｜Round 1: 8.2 -> Round 2 驗收通過 9.5 / 10.0）
- [x] **Step 1. 擴充 `Recurrence`（`weekOfMonth`/`weekday`）、`HabitPausedPeriod`、`CustomRhythmAnchor`、`PausedPlanEntry` 型別**（`src/lib/types.ts`）
- [x] **Step 2. 實作方案休眠純函式 `isPlanPaused`/`isItemPausedByPlan` 與單元測試**（`src/lib/sourcePlan.ts`、`src/__tests__/sourcePlan.test.ts`）
- [x] **Step 3. 實作第 4 顆自訂紅線錨點與休眠主題日過濾**（`src/lib/rhythm.ts`、`src/__tests__/rhythm.test.ts`）
- [x] **Step 4. 實作月度第 N 個星期 X 週期計算與顯示文案**（`src/lib/AppContextInternal/utils.ts`、`src/components/TaskDetailPanel.tsx`、`src/components/TaskForm.tsx`、`src/__tests__/recurrence.test.ts`）
- [x] **Step 5. 實作單一習慣預約休眠與累積目標池自動凍結純函式與測試**（`src/lib/habitBalance.ts`、`src/__tests__/habitBalance.test.ts`）
- [x] **Step 6. `useRhythmSettings` 串接 `customAnchor`/`pausedPlans` 與雲端 `enabled.custom` 同步修正**（`src/hooks/useRhythmSettings.ts`、`src/__tests__/useRhythmSettings.test.ts`）
- [x] **Step 7. `RhythmSection`/`RhythmBar`/`HabitsPage`/`ZenDashboard` UI 落地與 375px/深色模式/Esc/tomorrowStr 打磨**
- [x] **Step 8. 個人帳號 `supabase_cloud` 升級（`Highball 停杯紅線` 20:00、`學習、考試` 休眠至 `2027-01-01`、模考改每月第 1 個週六）**
- [x] **Step 9. Build Gate 驗收：`tsc` exit 0、`vitest` 22 files / 240 tests passed、`next build` 36/36 pages compiled**
