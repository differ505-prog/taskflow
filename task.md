# 方案 B：習慣「累積目標池」— 每日投入目標 + 缺額償還

> **狀態**：✅ 已實作完成（tsc clean / 128 tests passed / build exit 0）
> **完成日期**：2026-10-26
> **建立日期**：2026-10-26
> **設計決策（使用者已確認方案，以下為我提案並鎖定的實作規則）**

---

## 0. 一句話定義

為每個習慣新增「每日目標分鐘數」`dailyTargetMinutes`。習慣卡片即時顯示 **累計投入 − 累計目標 = 結餘**：

- 結餘 **≥ 0** → 顯示「結餘 +X 分」（習慣色）
- 結餘 **< 0** → 顯示「還差 X 分」（中性灰，可點擊展開補登面板償還）

出遊當天投入不足時，之後任何一天多投入的分鐘數會自動補回，不需要指定「補哪一天」。

## 1. 三條鎖定規則（實作時不可自行改動）

| # | 規則 | 原因 |
|---|---|---|
| R1 | **盈虧不影響打卡勾選**。`completed` 仍只由使用者點擊 / 番茄達標自動觸發 | 避免盈虧綁定打卡造成壓力與誤判 |
| R2 | **累計起算日 = `dailyTarget.minutesSetAt`**（設定目標的那天）。該日之前的 checkin 不計入目標、也不計入投入 | 讓既有用戶升級後不會一開啟就看到 −300 分 |
| R3 | **不贖回、不預支、不做負分動畫**。負值只顯示數字，不紅、不抖動、不責備語氣 | 對齊系統憲法 §5 情緒保護精神 |

## 2. 計算規格（單一事實來源）

### 2.1 每日投入值 `getCheckinMinutes(c, habit)`

```
c.minutes ?? ((c.pomodoros ?? 0) * (habit.pomodoroMinutes ?? 25))
```

這條 fallback 已存在兩處（`HabitsPage.tsx` 今日分鐘 / 歷史累計、`HabitsProvider.tsx` 多處），本次**抽成共用純函式並全數改用**，禁止再手寫第三份。

### 2.2 目標起算日 `getTargetStartDate(habit)`

```
habit.dailyTarget?.minutesSetAt || 建立日 (`habit.createdAt` 的本地日期)
```

回傳 `YYYY-MM-DD`。用 `toLocalDateString(new Date(habit.createdAt))` 計算本地日期，**不可直接切 `createdAt` 字串**（那是 ISO，跨時區會錯一天）。

### 2.3 累計結餘 `computeHabitBalance(habit, today)`

```
start = getTargetStartDate(habit)
若 start > today → { invested: 0, target: 0, balance: 0, days: 0 }   // 未來建立的習慣

days      = 從 start 到 today 的「含頭含尾」天數（一天 = 1，含 today 當天）
target    = dailyTargetMinutes * days
invested  = Σ getCheckinMinutes(c) for c in habit.checkins where start ≤ c.date ≤ today
balance   = invested − target
```

**注意**：`today` 當天的目標也計入（今天還沒投入 → 結餘從早上就是負的）。這是刻意的：白天看到「還差 30 分」就是今天的行動提示。

### 2.4 邊界處理

| 情況 | 期望輸出 |
|---|---|
| `habit.dailyTarget` 不存在 | 整段 UI 不渲染（`return null`），等同功能未啟用 |
| `dailyTargetMinutes <= 0` | 視為未啟用 |
| `today < start`（系統時間被往回調） | 回傳全 0，不崩 |
| 跨月 / 跨年 | 用 `new Date(y, m, d)` 逐日 +1 計算天數，**禁止用 `(dateB - dateA)/86400000`**（DST 會差一天） |
| 累積天數 > 3650 | 仍要能算（不設上限），但顯示端 `days` 不顯示 |
| `archivedAt` 存在 | 結餘膠囊照常顯示（灰階，跟封存卡片整體 opacity 0.65 一致） |

### 2.5 熱力圖色階（有目標時）

```
ratio = 當日投入 / dailyTargetMinutes
ratio = 0            → "var(--surface-hover)"（空格）
ratio < 1            → habit.color + "40"（有投入但不足）
1 ≤ ratio < 2        → habit.color + "88"
2 ≤ ratio < 3        → habit.color + "CC"
ratio ≥ 3            → habit.color（滿色，代表大幅補回缺額）
```

有 `dailyTargetMinutes` 時**改用這條**；沒有目標時維持現行 `completed` + 番茄數的舊邏輯，行為不變。

---

## 3. 檔案級實作清單（照順序做）

### 步驟 1｜型別：新增欄位

**檔案**：`src/lib/types.ts`（在 `Habit` interface 內，`pomodoroMinutes?` 之後）

```ts
  dailyTarget?: {
    minutes: number;      // 每日目標投入分鐘數（>0 才生效）
    minutesSetAt: string; // YYYY-MM-DD，設定當下本地日期 = 累計起算日（見 R2）
  };
```

- [x] 1.1 只加 `dailyTarget`，**不要動** `targetPomodoros` / `targetCount`（它們語義不同，不可合併）
- [x] 1.2 欄位必須 optional（舊資料沒有它）

### 步驟 2｜新增純函式模組（全部邏輯集中此處，可測）

**新檔案**：`src/lib/habitBalance.ts`

匯出：

| 函式 | 簽章 | 職責 |
|---|---|---|
| `getCheckinMinutes` | `(c: HabitCheckin, unitMinutes: number) => number` | §2.1 的 fallback |
| `getTargetStartDate` | `(habit: Habit) => string` | §2.2 |
| `daysInclusive` | `(start: string, end: string) => number` | §2.4 逐日計算，`end < start` 回 0 |
| `computeHabitBalance` | `(habit: Habit, today: string) => { minutes: number; invested: number; target: number; balance: number; days: number } \| null` | §2.3，未啟用回 `null` |
| `getHeatmapFill` | `(habit: Habit, date: string) => string \| null` | §2.5，未啟用回 `null`（呼叫端走舊邏輯） |
| `formatBalanceChip` | `(balance: number) => string` | `>=0` → `結餘 +${n} 分`；`<0` → `還差 ${-n} 分` |

- [x] 2.1 模組必須是純函式，不 import React、不讀 localStorage、不做 `console.log`
- [x] 2.2 內部 import 只允許 `@/lib/types`、`@/lib/dateUtils`
- [x] 2.3 `formatBalanceChip` 的負值文案**只能是「還差 X 分」**，禁止「欠」、「逾期」、「失敗」等字（§5 語氣）
- [x] 2.4 中文比較與字串操作一律不依賴 `\b`（§26-Q）

### 步驟 3｜Provider 寫入目標時自動蓋 `minutesSetAt`

**檔案**：`src/lib/AppContextInternal/HabitsProvider.tsx`

- [x] 3.1 `updateHabit` 增加守衛（位置：進入 `habits.map` 之前）：

```ts
// 設定「每日目標」時，若呼叫端沒帶 minutesSetAt，自動蓋上本地今天（R2 起算日）
if (updates.dailyTarget && !updates.dailyTarget.minutesSetAt) {
  updates = {
    ...updates,
    dailyTarget: { ...updates.dailyTarget, minutesSetAt: getLocalToday() },
  };
}
```

- [x] 3.2 `addHabit` 同樣處理：`data.dailyTarget` 有 `minutes` 但缺 `minutesSetAt` 時，在建立時補上今天
- [x] 3.3 **不可**在 `checkinHabit` / `logHabitTime` / `incrementHabitPomodoro` 裡改 `dailyTarget`（累計目標不隨打卡變動）
- [x] 3.4 既有 `computeHabitStreak` 呼叫與 streak 邏輯**完全不動**
- [x] 3.5 `getLocalToday` 需從 `../dateUtils` import（若尚未 import）

### 步驟 4｜卡片 UI：結餘膠囊

**檔案**：`src/components/HabitsPage.tsx` — `HabitRow`

- [x] 4.1 `HabitRow` 新增 prop：`onRepay?: () => void`（展開補登面板），由父層傳入 `() => setShowTimeLogger(true)`——但 `showTimeLogger` 是 `HabitRow` 內部 state，因此改為**內部直接 `setShowTimeLogger(true)`，不需新 prop**
- [x] 4.2 在「雙維度時長徽章」那一列的結尾（`補登時長` 按鈕之後）插入膠囊，DOM 位置固定為：

```
<div className="flex items-center gap-2 mt-1.5 ...">   ← 既有容器，行號約 565
   今日 X 分 · 歷史累計 Y · [⏱️ 補登時長]
   <span>·</span>
   <button|span> 結餘 +X 分 / 還差 X 分 </button|span>   ← 新增，放這裡
</div>
```

- [x] 4.3 條件：`habit.dailyTarget?.minutes > 0` 且 `computeHabitBalance` 非 null 才渲染；否則不輸出任何 DOM
- [x] 4.4 正值樣式：`background: var(--brand-tint)`、`color: habit.color`、`rounded`、`px-1.5 py-0.5 text-[10px] tabular-nums`，`title` 寫「累計投入 X 分 − 目標 Y 分（起算 M/D）」
- [x] 4.5 負值樣式：`color: var(--text-tertiary)`、`background: transparent`、`border: 1px dashed var(--border)`，**可點擊**
- [x] 4.6 負值點擊行為：`setShowTimeLogger(true)`（展開既有補登面板，零新增 UI）
- [x] 4.7 負值 `aria-label` = `還差 ${n} 分鐘達標，點擊補登時長`
- [x] 4.8 禁止 `red-*`、禁止 `animate-bounce`/`animate-pulse`/`animate-shake`、禁止驚嘆號
- [x] 4.9 封存卡片（`isArchived`）時膠囊仍渲染但 `disabled` 且不加 hover

### 步驟 5｜編輯 / 建立表單：每日目標輸入

**檔案**：`src/components/HabitsPage.tsx`

- [x] 5.1 `HabitFormData` 增加 `dailyTargetMinutes: number`（預設 `0` = 未啟用）
- [x] 5.2 `form` 初始 state 與所有 `setForm({...})` 重設處（共 3 處：初始、`handleSubmit`、`cancelEdit`）補 `dailyTargetMinutes: 0`——漏一處會導致 TS 錯誤，靠步驟 7 的 `tsc` 抓
- [x] 5.3 `openEditForm` 讀 `habit.dailyTarget?.minutes ?? 0`
- [x] 5.4 `handleSubmit` 寫入：

```ts
dailyTarget: form.dailyTargetMinutes > 0
  ? { minutes: form.dailyTargetMinutes, minutesSetAt: habit?.dailyTarget?.minutesSetAt ?? getLocalToday() }
  : undefined,
```

- [x] 5.5 `edit` 分支需先取得舊 habit：`const old = habits.find(h => h.id === editingHabitId)`，保留其 `minutesSetAt`（避免每次編輯目標就把起算日往後推，導致已累積的負債被抹掉）
- [x] 5.6 表單 UI：在「Color」區塊與 `description` textarea 之間插入一列：

```
每日目標投入   [不設定] [15分] [25分] [30分] [45分] [60分] [自訂__分]
```

- [x] 5.7 膠囊按鈕沿用 `frequency` 按鈕的樣式語言（`py-2 rounded-xl text-[13px]`，選中 = `var(--brand-tint)` + `var(--brand)`），可橫向 `flex-wrap`
- [x] 5.8 「不設定」= `dailyTargetMinutes: 0`
- [x] 5.9 自訂輸入：`type="number" min=1 max=720`，空字串時不覆蓋；輸入值 >0 就即時寫進 `form.dailyTargetMinutes`
- [x] 5.10 表單就地提示文案（`text-[11px]`、`var(--text-tertiary)`）：`設定後，未補滿的天數可由之後多投入的分鐘數補回`

### 步驟 6｜熱力圖改用比例色階

**檔案**：`src/components/HabitsPage.tsx` — `HabitRow.heatmapColors`

- [x] 6.1 函式體內第一行插入：

```ts
const fill = getHeatmapFill(habit, date);
if (fill !== null) return fill;
// ↓ 以下為原邏輯，完全不動
```

- [x] 6.2 `completedDays` 與 `heatmapColors` 的舊分支保留（無目標時靠它們）
- [x] 6.3 熱力圖格子的 `title` 有目標時改為 `${date} · 投入 ${mins} 分 / 目標 ${target} 分`

### 步驟 7｜去重：把重複的 fallback 換成共用函式

**檔案**：`src/components/HabitsPage.tsx`、`src/lib/AppContextInternal/HabitsProvider.tsx`

- [x] 7.1 `HabitsPage.tsx` 今日分鐘：`currentCheckin?.minutes ?? (todayPoms * unitMinutes)` → `getCheckinMinutes(currentCheckin, unitMinutes)`（`currentCheckin` 可能 undefined → 呼叫端保留 `currentCheckin ? getCheckinMinutes(...) : 0`）
- [x] 7.2 `HabitsPage.tsx` 歷史累計 `reduce` 內算式 → `getCheckinMinutes(c, habit.pomodoroMinutes ?? 25)`
- [x] 7.3 `HabitsPage.tsx` 約 928–932 行的「今日總番茄時長」`reduce` 內算式 → 同一函式
- [x] 7.4 `HabitsProvider.tsx` 中 3 處 `existing.minutes ?? ((existing.pomodoros ?? 0) * ...)` / `c.minutes ?? ((c.pomodoros ?? 0) * unitMins)` 改為呼叫 `getCheckinMinutes`（import 自 `../habitBalance`）
- [x] 7.5 改完後 `grep -rn "?? ((c.pomodoros" src/` 應只剩 `habitBalance.ts` 一處

### 步驟 8｜測試（新檔）

**新檔案**：`src/__tests__/habitBalance.test.ts`

必測案例（每條一個 `it`）：

- [x] 8.1 未設定 `dailyTarget` → `computeHabitBalance` 回 `null`
- [x] 8.2 `minutes = 0` → 回 `null`
- [x] 8.3 起算日 = 今天、今天目標 30 分、投入 0 → `balance = -30`、`days = 1`
- [x] 8.4 起算日 3 天前、目標 30 分/天、投入 [60, 10, 50] → `invested = 120`、`target = 90`、`balance = +30`（覆蓋你「出遊回來補回」的劇本）
- [x] 8.5 同 8.4 但今天只投入 10 分 → `invested = 80`、`target = 90`、`balance = -10`
- [x] 8.6 `minutesSetAt` 之前的 checkin **不計入** `invested`（R2 回歸測試）
- [x] 8.7 只有 `pomodoros` 沒有 `minutes` → 用 `pomodoros × pomodoroMinutes` 計入
- [x] 8.8 跨月案例（`2026-01-30` → `2026-02-02`）`days = 4`
- [x] 8.9 `today` 早於 `minutesSetAt`（未來日）→ `balance = 0`，不拋錯
- [x] 8.10 `formatBalanceChip(0)` = `結餘 +0 分`；`formatBalanceChip(-20)` = `還差 20 分`；`formatBalanceChip(65)` = `結餘 +65 分`
- [x] 8.11 `getHeatmapFill`：ratio 0 / 0.5 / 1.5 / 2.5 / 3.5 → 五個不同回傳值，且 ratio 0 是 `var(--surface-hover)`
- [x] 8.12 既有 `habitCheckinWithPomodoro.test.ts`、`habitDateRollover.test.ts` 仍全數通過（不可改動這兩個檔）

### 步驟 9｜驗證與收尾（§12 必讀結果）

- [x] 9.1 `npx tsc --noEmit` → **讀完整 stderr**。允許殘留的唯一錯誤：`src/__tests__/logger.test.ts` 的 4 個 `NODE_ENV read-only`（既有問題，SSOT 已記錄）。出現任何其他錯誤 = 失敗，不准宣告完成
- [x] 9.2 `npm test` → 必須全數通過（現有 108 + 新增 12 ≒ 120），貼出 `Tests  N passed` 那行
- [x] 9.3 `npm run build` → exit code 必須 0，貼出 route 數量與 `Compiled successfully`
- [x] 9.4 `grep -rn "dailyTarget" src/` 確認型別、Provider、UI、測試四處都有，沒有漏接
- [x] 9.5 更新本檔狀態為「✅ 完成」，並在「驗收清單」勾選實機驗證結果

## 4. 絕對禁止（紅線）

1. ❌ 不得新增 SQL migration 或動 Supabase schema（`dailyTarget` 走 `personal_habits.data` JSONB）
2. ❌ 不得動 `personalHabitSync.ts`（同步層已整份 JSONB 覆寫，加欄位自動生效，§23）
3. ❌ 不得讓盈虧影響 `completed`、`streak`、`longestStreak`
4. ❌ 不得在 `LostAndFound` 相關檔案加入任何東西
5. ❌ 不得使用紅色系 / 驚嘆號 / 抖動動畫 / 倒數計時
6. ❌ 不得把 `dailyTarget` 與 `targetPomodoros`（達標自動打卡）混為一談
7. ❌ 不得改 `src/lib/usePomodoro.ts`、`completionSound.ts`、`ZenFlowProvider.tsx`（上一版已完成，本次不碰）

## 5. 預估

| 項目 | 量 |
|---|---|
| 改動檔案 | 4（`types.ts`、`HabitsPage.tsx`、`HabitsProvider.tsx`、`task.md`） |
| 新增檔案 | 2（`src/lib/habitBalance.ts`、`src/__tests__/habitBalance.test.ts`） |
| 預估工時 | 2–3 小時（含測試與建置驗證） |
| 風險 | 低。純附加 optional 欄位，舊資料不需遷移，回滾 = 移除 UI 條件渲染即可 |

---

## 6. 驗收清單（實機，需使用者執行）

- [ ] 6.1 編輯任一習慣 → 設「每日目標 30 分」→ 卡片出現「還差 30 分」虛線膠囊
- [ ] 6.2 點該膠囊 → 補登面板展開 → 按 `+30分` → 膠囊變「結餘 +0 分」
- [ ] 6.3 再按 `+60分` → 膠囊變「結餘 +60 分」，熱力圖今天顏色加深
- [ ] 6.4 切到昨天（日曆選日期）投入 0 → 結餘仍只依今天資料計算，不會因切換日期亂跳（結餘恆以「今天」為終點）
- [ ] 6.5 重整頁面 → 結餘與熱力圖色階保持一致（JSONB 已同步）
- [ ] 6.6 手機上膠囊不擠壓「歷史累計」文字（`flex-wrap` 生效）
