# Task Board — 高回報複利習慣系統（UI/UX 總監執行藍圖）

## 【上市產品成熟度驗收儀表板】
- **當前輪次**：Round 1 / 4（面向一 T1–T7 已實作並通過 Build Gate，待首次上市審查）
- **目標總分**：`>= 9.0 / 10.0`（且五維度皆 `>= 1.7 / 2.0`，零上市紅線）
- **上市紅線狀態**：待檢驗
- **五維度評分明細**：
  1. 核心價值與業務閉環：`- / 2.0`
  2. 視覺工藝與品牌信任感：`- / 2.0`
  3. 微互動與多端適配體驗：`- / 2.0`
  4. 極端邊界與防呆韌性：`- / 2.0`
  5. 商業細節與上市合規度：`- / 2.0`

### 本輪實作摘要（面向一，待複驗）
- `[?]` T1｜新增 `src/lib/compoundHabitPlan.ts`：`COMPOUND_PLAN`、4 個 `COMPOUND_HABIT_TEMPLATES`、`getActiveCompoundExperiment`、`canActivateCompoundExperiment`（1-Slot 閥門）、`buildReflectionNote` / `parseReflectionNote`（可雙向還原）、`isReflectionHabit`
- `[?]` T2｜新增 `src/__tests__/compoundHabitPlan.test.ts`：15 個案例涵蓋 1-Slot 閥門、封存退場、筆記 round-trip、範本完整性
- `[?]` T3｜`HabitsPage` 新增 `NotebookPen` 復盤筆記入口 + 折疊編輯面板（`--surface-hover` / `--radius-xl`）+ 已存筆記單行預覽；已打卡時 `count=0` 不重複加次
- `[?]` T4｜新增 `src/components/CompoundExperimentPickerModal.tsx`：4 張範本卡片、`allowed === false` 溫柔鎖定橫幅、`sourcePlan: COMPOUND_PLAN` 掛載、ESC 關閉 + 背景鎖捲動
- `[?]` T5｜新增 `src/components/WrapUpReflectionSheet.tsx` + `TodayWrapUpButton` 接棒：下班閥門後延遲 900ms 浮出 30 秒復盤（可一鍵「先休息」），以 `buildReflectionNote` 寫入 `HabitCheckin.note`
- `[?]` T6｜新增 `src/hooks/useDeclineTask.ts`：僅 Q3/Q4 且未完成未封存時顯示「勇敢說不」（`ShieldCheck`），加「已拒絕」標籤去重 + 封存 + `addPp(5)` + 溫柔 toast；已接入 `TaskDetailPanel` / `TaskListItem` / `AppShell`
- `[?]` T7｜Build Gate 全通過（見下）

### Build Gate 結果
- `npx tsc --noEmit` → exit 0（clean）
- `npx vitest run` → 20 files / 199 tests 全數通過
- `npm run build` → exit 0（success）
- `npm run lint` → 專案未配置 ESLint flat config（`next lint` 進入互動式初始化），沿用 `tsc + vitest + build` 作為靜態驗證

### 靜態檢查（雙主題 / 375px 響應式）
- 新增檔案零硬編碼色階（無 `bg-red-*` / `dark:` / hex），全部走 `var(--*)` Token
- 無 `w-[3xx]px` / `min-w-[3xx]px` 固定寬度 → 375px 下無橫向溢位
- 習慣頁工具列改 `flex-wrap`，次要按鈕文字於 `< sm` 隱藏僅留 icon
- 新增互動元件觸控目標皆 `min-h-[44px]`

> 歷史紀錄：Round 1–3 UI/UX 基礎驗收已結案並歸檔至 [docs/task-archive.md](docs/task-archive.md)。
> 執行規範：每步只改指定檔案；完成每步後執行對應 Gate；UI 文案嚴守 [VOICE_AND_TONE.md](VOICE_AND_TONE.md)（用「你」、動詞按鈕、禁用「過期/逾期/失敗」）；樣式嚴守 [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)（Token、圓角、`lucide-react`、`>= 44×44px` 觸控區）。

---

## 面向一：全用戶框架優化（待低階模型接手執行）

- [?] **T1｜建立「單一實驗」領域模組與復盤筆記純函式**
  - **目標檔案**：新增 `src/lib/compoundHabitPlan.ts`（純 TypeScript，無 React 依賴）
  - **實作內容**：
    1. 定義常數 `COMPOUND_PLAN = { id: "plan-compound-12", name: "高回報複利實驗" } as const`。
    2. 匯出 `COMPOUND_HABIT_TEMPLATES`（4 個精選實驗：每日 `#1+#12 睡前100字決策復盤＋一句真話`、每日 `#3 30分鐘無螢幕深度思考`、每日 `#6 每天一件微不適小事`、每週 `#2+#8 弱關係問候與資產盤點`），每個包含 `id`, `title`, `description`, `frequency`, `pomodoroMinutes`, `dailyTargetMinutes`, `color`, `discomfortHint`。
    3. 匯出 `getActiveCompoundExperiment(habits: Habit[]): Habit | null`（回傳未封存且 `sourcePlan?.id === COMPOUND_PLAN.id` 的第一筆）。
    4. 匯出 `canActivateCompoundExperiment(habits: Habit[]): { allowed: boolean; activeHabit: Habit | null }`（強制「同時最多 1 個進行中實驗」，防 ADHD 貪多棄坑）。
    5. 匯出 `buildReflectionNote(fields: { decision: string; outcome: string; nextStep: string; hardTruth?: string }): string` 與 `parseReflectionNote(note?: string)`，格式清晰純文字且可雙向還原。
  - **驗證 Gate**：`npx tsc --noEmit`

- [?] **T2｜補齊 `compoundHabitPlan` 單元測試**
  - **目標檔案**：新增 `src/__tests__/compoundHabitPlan.test.ts`
  - **測試案例**：
    1. 無進行中實驗時 `canActivateCompoundExperiment` 回傳 `allowed: true`。
    2. 已有 1 個未封存的 `plan-compound-12` 習慣時回傳 `allowed: false` 並帶出該 `activeHabit`；封存後恢復 `allowed: true`。
    3. `buildReflectionNote` / `parseReflectionNote` 支援空白欄位過濾與正確 round-trip。
    4. 搭配 `src/lib/sourcePlan.ts` 的 `archivePlanHabits` 可正常整套退場。
  - **驗證 Gate**：`npx vitest run src/__tests__/compoundHabitPlan.test.ts src/__tests__/sourcePlan.test.ts`

- [?] **T3｜開放 `HabitCheckin.note` 微型復盤筆記 UI（所有習慣可用）**
  - **目標檔案**：`src/components/HabitsPage.tsx`
  - **現況確認**：`src/lib/AppContextInternal/HabitsProvider.tsx` 的 `checkinHabit(id, date, count = 1, note?: string)` 與 `HabitCheckin.note` 已支援同步，但畫面尚無讀寫入口。
  - **實作內容**：
    1. 在 `HabitRow` 雙維度時長列（`⏱️ 補登時長` 旁）新增 `NotebookPen`（`lucide-react`）按鈕「📝 復盤筆記」（若有今日 `currentCheckin?.note` 則顯示品牌色微光點提示）。
    2. 新增 `showNoteEditor` 折疊面板（`bg-[var(--surface-hover)]`, `border-[var(--border)]`, `rounded-xl`），提供精簡輸入框（placeholder：`今天做了什麼決定 → 結果 → 下次怎麼改`）與「存下復盤」按鈕。
    3. `HabitRow` 新增 prop `onSaveNote: (note: string) => void`；在 `HabitsPage` 主列表呼叫 `checkinHabit(habit.id, selectedDate, isDone ? 0 : 1, note)`（注意：若當天已打卡則 `count=0` 避免重複加次；不可誤觸發 `uncheckHabit`）。
    4. 若 `currentCheckin?.note` 存在且面板收合，於卡片內顯示單行 `.truncate` 預覽。
  - **驗證 Gate**：`npx tsc --noEmit`

- [?] **T4｜在習慣頁加入「1-Slot 複利實驗挑選器」Modal**
  - **目標檔案**：新增 `src/components/CompoundExperimentPickerModal.tsx`，並修改 `src/components/HabitsPage.tsx`
  - **實作內容**：
    1. 在 `HabitsPage.tsx` 頂部工具列（`新增習慣` 旁）加入輕量按鈕「複利實驗」（使用 `Compass` icon，遵守行動端響應式不溢出 `375px`）。
    2. Modal 容器使用 `rounded-xl`、`bg-[var(--surface-elevated)]`、`border-[var(--border)]`，列出 `COMPOUND_HABIT_TEMPLATES` 4 張卡片。
    3. 呼叫 `canActivateCompoundExperiment(habits)`：若 `allowed === false`，顯示溫柔鎖定橫幅「目前正在進行『{activeHabit.title}』— 一次只專注一個最有效，想切換可先封存目前實驗」，並禁用其他卡片的「開始實驗」按鈕。
    4. 若 `allowed === true`，點擊「開始實驗」呼叫 `addHabit({ title, description, frequency, color, targetCount: 1, pomodoroMinutes, dailyTarget: { minutes, minutesSetAt: getLocalToday() }, sourcePlan: COMPOUND_PLAN })`，關窗並 `toast.success("已開啟單一實驗 ✓")`。
  - **驗證 Gate**：`npx tsc --noEmit`

- [?] **T5｜「今天先這樣」下班閥門接棒 30 秒睡前復盤（可選、不打斷休息）**
  - **目標檔案**：新增 `src/components/WrapUpReflectionSheet.tsx`，並修改 `src/components/TodayWrapUpButton.tsx`
  - **實作內容**：
    1. 在 `TodayWrapUpButton.tsx` 的 `onWrapComplete` 後（已發放 `+5 PP` 後），檢查 `habits` 中是否存在未封存、今日尚未填寫 `note` 且標題含「復盤」或 `sourcePlan?.id === "plan-compound-12"` 的習慣。
    2. 若存在，延遲顯示可一鍵關閉的 `WrapUpReflectionSheet`（主按鈕「存進今日復盤」、副按鈕「先休息」；禁用「跳過可惜」等責備語氣）。
    3. 送出後使用 `buildReflectionNote` 組字並呼叫 `checkinHabit(habit.id, getLocalToday(), isAlreadyDone ? 0 : 1, note)`，顯示 `toast.success("今日復盤已收好 ✓")`。
    4. `WrapUpReflectionSheet` 需符合 Dark/Light Token 與行動端 `safe-bottom`。
  - **驗證 Gate**：`npx tsc --noEmit`

- [?] **T6｜Q3/Q4 任務加入「🛡️ 勇敢說不」注意力防線動作（對應習慣 #11）**
  - **目標檔案**：先 `grep -rn "archiveTask\|delegate" src/components/TaskDetailPanel.tsx src/components/TaskListItem.tsx src/components/EisenhowerQuadrantGrid.tsx` 確認既有封存按鈕位置，再於「任務詳情面板 / 象限卡片」補入動作。
  - **實作內容**：
    1. 僅對 `priority === "delegate" || priority === "none"` 且未封存、未完成的任務顯示「勇敢說不」Ghost 按鈕（`ShieldCheck` icon from `lucide-react`）。
    2. 點擊後執行：為任務加上 `"已拒絕"` tag（去重）、將 `isArchived` 設為 `true`、呼叫 `addPp(5)` 給予守住注意力的正向獎勵，並顯示 `toast.success("已守住注意力，送進封存 ✓")`。
  - **驗證 Gate**：`npx tsc --noEmit`

- [?] **T7｜全站靜態、單元測試與雙主題/響應式最終驗收**
  - **執行指令**：
    1. `npx tsc --noEmit`（零型別錯誤）
    2. `npm run lint`（零新增 ESLint 錯誤）
    3. `npx vitest run`（全數測試通過，含 `compoundHabitPlan.test.ts`）
    4. 靜態檢查 `[data-theme="dark"]` / Light Token 與 `375px` 手機寬度無橫向溢位（嚴禁啟動或終止本地 Port）。

---

## 面向二：個人帳號 API 專屬設定（已完成並於雲端驗證）

> 設計原則：保留你既有的 `plan-3.0`（一人公司 3.0：週一至週六主題日 + 健身/搞錢/學習/吉他習慣），僅補入目前帳號缺口最高、符合「不貪多」原則的項目，全部掛載 `sourcePlan: { id: "plan-compound-12", name: "高回報複利實驗" }`，可隨時於「設定 → 日常節奏」一鍵「整套退場」。

- [x] **A1｜合併補齊週日戰略主題日（`rhythm-profile`）**
  - 呼叫 `POST https://www.vibelist.work/api/agent` (`action: "set_rhythm_profile"`)
  - 完整保留既有 `plan-3.0` 的 3 個主題日（週一/三/五 Vibe Coding、週二/四 裝修美容、週六 手作施工），補齊空白的星期日 `[0]`：`compound-sunday-think`（「🧭 戰略留白 ＆ 跨界輸入」，對應習慣 #3 + #4 + #5）。
- [x] **A2｜建立唯一每日主實驗（`compound-habit-daily-review`）**
  - 呼叫 `add_habit`：「睡前 100 字決策復盤 ＋ 一句真話」（每日 10 分鐘，對應習慣 #1 + #12）。
- [x] **A3｜建立每週低頻高槓桿任務 × 3（分散排程、避免單日過載）**
  - `compound-task-info-purge`（`2026-11-26`）：「資訊清源：拉黑 3 個製造焦慮的帳號 ＋ 做 1 件微不適小事」（#7 + #6）
  - `compound-task-weak-tie`（`2026-11-29` 每週日重複）：「問候 1 位久未聯絡的人（不群發，真誠問近況）」（#2）
  - `compound-task-finance-audit`（`2026-11-29` 每週日重複）：「週度財務資產盤點：複利投資 vs 純消耗」（#8）
- [x] **A4｜雲端讀取驗證通過（`source: supabase_cloud`）**
  - 驗證指令：`npx tsx scripts/agent-cli.ts list habits && npx tsx scripts/agent-cli.ts list tasks`
  - 若需調整或撤銷：進入網頁端「設定 → 日常節奏 → 已安裝方案 → 高回報複利實驗 → 整套退場」。
