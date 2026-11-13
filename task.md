# 方案 C（優化版 v2，方案評分 9.3 / 10）：節奏錨點 ＋ 主題日 ＋ MVD 低耗能 ＋ 產出計數

> **狀態**：⏳ 待你確認，確認後才可動手落地（禁止跳步，依序執行）
> **設計立場**：計畫是「班表」，產品是「節奏」。不做完整時間軸日曆（時間軸是 ADHD 焦慮源，且會把產品拖成普通排程工具）。
> 四件事：① 三個作息錨點 ② 每日主題日 ③ 手動 MVD 低耗能 ④ 任務產出計數。

## 0. 紅線（每一步都適用，違反即停）

1. 不新增 Supabase migration。節奏設定（含主題日）以 **一筆 JSONB 資料同步到 `personal_habits`**，id 固定為 `rhythm-profile`、type 欄位標記 `kind: "rhythm-profile"`，由既有 `personalHabitSync.ts` 的 upsert／realtime 自動生效（§23 已確認：不動 sync 層本身）。
2. UI 文案禁用：紅色系（`red-*`）、驚嘆號、倒計時、「過期」「逾期」「未完成」「失敗」「欠」「賴床」。
3. 錨點提醒只用 toast / StatusWindow，每錨點每天最多一次，可手動關閉；絕不自動改任務、自動改視圖、自動搶 Zen 焦點（§5a）。
4. MVD 只做「視覺降噪＋進度條」，任務不消失、不搬移、不改 `order`。
5. 主題日只做「提示今天主攻哪一條線」，絕不自動排程、絕不自動建立任務、絕不自動改任務 priority。
6. 不碰：`LostAndFound.tsx`、`usePomodoro.ts`、`completionSound.ts`、`ZenFlowProvider.tsx`、`FlowTimer.tsx`、`personalTaskSync.ts`、`personalHabitSync.ts`、`firestore.ts`、`sharedSync.ts`。
7. 每步驗證只准 `npx tsc --noEmit`、`npx eslint <檔案>`、`npx vitest run <檔案>`；嚴禁 `npm run dev`、嚴禁啟動任何本地伺服器或佔用 Port。

---

## Step 1｜型別：Task 產出欄位 ＋ Rhythm 型別

- **目標檔案**：`src/lib/types.ts`（1 個）
- **變更內容**：在 `Task` interface（`focusMinutes` 之後）追加：
```ts
outputTarget?: { count: number; unit: string }; // 產出目標，如 5 張圖；undefined = 未啟用
outputCount?: number; // 已累積產出（預設 0）
```
  檔尾追加：
```ts
export type RhythmAnchorId = "wake" | "offduty" | "screensoff";
export type ThemeDayId = string; // 使用者自訂的主題日 key，如 "vibe-coding"

export interface RhythmAnchorConfig {
  id: RhythmAnchorId;
  label: string;
  time: string;   // "HH:mm"
  enabled: boolean;
}

export interface ThemeDay {
  id: ThemeDayId;
  label: string;      // 例：「Vibe Coding」
  emoji: string;      // 例：「💻」
  weekdays: number[]; // 0=Sun..6=Sat，該主題日的星期
  tag?: string;       // 關聯的任務標籤（選填，用於統計）
}

export interface RhythmSettings {
  wakeTime: string;       // "08:00"
  offDutyTime: string;    // "17:00"
  screensOffTime: string; // "22:15"
  enabled: Record<RhythmAnchorId, boolean>;
  mvdEnabled: boolean;
  themeDays: ThemeDay[];  // 每日主題日清單（可空）
}

export const DEFAULT_RHYTHM_SETTINGS: RhythmSettings = {
  wakeTime: "08:00", offDutyTime: "17:00", screensOffTime: "22:15",
  enabled: { wake: true, offduty: true, screensoff: true },
  mvdEnabled: false,
  themeDays: [],
};

/** 節奏設定同步載體（存進 personal_habits JSONB，id 固定 rhythm-profile） */
export interface RhythmProfile {
  id: "rhythm-profile";
  kind: "rhythm-profile";
  settings: RhythmSettings;
  updatedAt: string;
}
```
- **驗證**：`npx tsc --noEmit` → 讀完整 stderr＋exit code；只允許殘留 `src/__tests__/logger.test.ts` 的既有 `NODE_ENV` 錯誤，其餘 0 error 才算過。
- **依賴**：無（第一步）。

## Step 2｜純函式：節奏錨點 ＋ 主題日

- **目標檔案**：`src/lib/rhythm.ts`（新建，1 個）
- **變更內容**：純函式，不 import React，不讀 localStorage，只准 import `@/lib/types`。匯出：
```ts
parseHHmm(s: string): number | null;             // "08:00" → 自午夜起分鐘數，非法回 null
getMinutesSinceMidnight(d: Date): number;
getActiveAnchor(now: Date, s: RhythmSettings): RhythmAnchorId | null; // 命中整點前後 10 分鐘窗且 enabled 才回傳，否則 null
isOffDutyNow(now: Date, s: RhythmSettings): boolean; // now ≥ offDutyTime 且 < screensOffTime
anchorCopy(id: RhythmAnchorId): { title: string; body: string }; // 文案禁驚嘆號、禁責備語氣
getTodayTheme(s: RhythmSettings, now: Date): ThemeDay | null; // 依 now.getDay() 找命中 weekdays 的主題日；多筆命中取第一筆；無則 null
themeCopy(t: ThemeDay): { title: string; body: string }; // 例：title="💻 Vibe Coding"，body="今天主攻這條線"
```
  文案固定：`wake` →「早安，開機時間到了」；`offduty` →「下班閥門，剩下的先送回大廳」；`screensoff` →「熄屏時間到，眼睛先下班」。
- **驗證**：`npx tsc --noEmit`（同 Step 1 標準）。
- **依賴**：Step 1。

## Step 3｜純函式：MVD 進度 ＋ 產出計數

- **目標檔案**：`src/lib/mvd.ts`、`src/lib/outputCount.ts`（新建，2 個）
- **變更內容**：
  - `mvd.ts`：
```ts
export const MVD_TARGET_PCT = 20;
computeMvdProgress(total: number, done: number): { total: number; done: number; pct: number; reached: boolean };
// total<=0 → {0,0,0,false}；pct = done/total*100；reached = pct >= 20
```
  - `outputCount.ts`：
```ts
incrementOutputCount(n: number | undefined): number; // (n ?? 0) + 1
outputProgress(count: number | undefined, target?: { count: number; unit: string }): { done: number; target: number; unit: string; pct: number } | null; // 無 target 回 null
formatOutputLabel(count: number | undefined, target?: { count: number; unit: string }): string; // "2/5 張"；無 target 回 ""
```
- **驗證**：`npx tsc --noEmit`（同 Step 1 標準）。
- **依賴**：Step 1。

## Step 3.5｜單元測試：純函式三檔

- **目標檔案**：`src/__tests__/rhythm.test.ts`、`src/__tests__/mvd.test.ts`、`src/__tests__/outputCount.test.ts`（新建，3 個）
- **變更內容**（每條一個 `it`）：
  - `rhythm.test.ts`：`parseHHmm("08:00")` = 480；`parseHHmm("24:00")` = null；`parseHHmm("abc")` = null；`getActiveAnchor` 在 07:55 / 08:05 / 08:30 三種時刻對 `wakeTime="08:00"` 分別回 `"wake"` / `"wake"` / `null`；`enabled.wake=false` 時回 `null`；`isOffDutyNow` 在 17:00 回 true、22:20 回 false、16:59 回 false；`anchorCopy("offduty").title` 不含驚嘆號與禁用語（「過期」「逾期」「未完成」「失敗」「欠」）；`getTodayTheme` 對 weekdays=[1,3,5]（週一三五）於週三回該筆、於週二回 null；多筆命中取第一筆；`themeCopy` 含 label。
  - `mvd.test.ts`：`computeMvdProgress(0,0)` → `{total:0,done:0,pct:0,reached:false}`；`computeMvdProgress(10,2)` → `pct=20, reached=true`；`computeMvdProgress(10,1)` → `pct=10, reached=false`；`computeMvdProgress(3,1)` → `pct` 為 33.33…（用 `toBeCloseTo`）。
  - `outputCount.test.ts`：`incrementOutputCount(undefined)` = 1；`incrementOutputCount(3)` = 4；`outputProgress(undefined, undefined)` = null；`outputProgress(2, {count:5,unit:"張"})` → `{done:2,target:5,unit:"張",pct:40}`；`formatOutputLabel(2, {count:5,unit:"張"})` = `"2/5 張"`；`formatOutputLabel(2, undefined)` = `""`。
- **驗證**：`npx vitest run src/__tests__/rhythm.test.ts src/__tests__/mvd.test.ts src/__tests__/outputCount.test.ts` → 讀完整 stdout，必須顯示全部 passed、exit code 0；再跑 `npx tsc --noEmit`（同 Step 1 標準）。
- **依賴**：Step 2、Step 3。

## Step 4｜設定存放：useRhythmSettings（localStorage ＋ 雲端同步）

- **目標檔案**：`src/hooks/useRhythmSettings.ts`（新建，1 個）
- **變更內容**：
  - **localStorage 快取**：key `taskflow:rhythm_settings:v1`。SSR-safe lazy init ＋ 跨分頁 `storage` 事件同步（比照 `useUserPreferences.ts`）。
  - **雲端同步**：透過 `useAuth()` 取 `user.uid`，登入時用 `supabase.from("personal_habits").upsert({ id: "rhythm-profile", owner_uid: uid, data: { id:"rhythm-profile", kind:"rhythm-profile", settings, updatedAt }, is_archived: false })` 寫入；載入時 `supabase.from("personal_habits").select("data").eq("id","rhythm-profile").eq("owner_uid",uid).maybeSingle()` 讀取後覆蓋 local 狀態。
  - **合併策略**：`updatedAt` 較新者勝（雲端 vs 本地），避免舊值蓋新值。
  - **寫入節流**：使用者每次變更 localStorage 立即寫；雲端 upsert 以 2 秒 debounce，避免連點打爆請求。
  - **防火牆**：寫入失敗（離線／未登入）只 warn 不 throw，本地功能照常可用。
  - API：
```ts
{ settings: RhythmSettings; isHydrated: boolean;
  update(patch: Partial<RhythmSettings>): void;
  toggleMvd(): void;
  setAnchorTime(id: RhythmAnchorId, hhmm: string): void;
  toggleAnchor(id: RhythmAnchorId): void;
  setThemeDays(days: ThemeDay[]): void;
  addThemeDay(day: { label: string; emoji: string; weekdays: number[]; tag?: string }): void;
  removeThemeDay(id: ThemeDayId): void;
}
```
  非法 `hhmm`（`parseHHmm` 回 null）直接忽略不寫入。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/hooks/useRhythmSettings.ts`，exit code 皆 0。
- **依賴**：Step 1、Step 2。

## Step 5｜提醒觸發：useRhythmAnchors

- **目標檔案**：`src/hooks/useRhythmAnchors.ts`（新建，1 個）
- **變更內容**：每 60 秒 tick（比照 `useDueDateReminder.ts`），用 `getActiveAnchor(new Date(), settings)` 判定；命中且當天未發過（log key `taskflow:rhythm_anchor_log:v1`，key=`${anchorId}:${YYYY-MM-DD}`）→ 發 toast（`sonner`，`duration: 6000`，固定 `id: rhythm-${anchorId}-${date}` 去重）。只做提醒：不改任務、不改視圖、不開 modal（§5a）。
  掛載點：**`src/components/AppProviders.tsx`** — 緊接既有 `<DueDateReminderWatcher />` 之後加 `<RhythmAnchorWatcher />`（新增一個 3 行的 watcher 元件於同檔，或直接在此檔加 import 後渲染）。不改 `DueDateReminderWatcher.tsx`。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/hooks/useRhythmAnchors.ts src/components/AppProviders.tsx`，exit code 皆 0。
- **依賴**：Step 2、Step 4。

## Step 6｜任務表單：產出目標輸入

- **目標檔案**：`src/components/TaskForm.tsx`（1 個）
- **變更內容**：在「具體時間」區塊之後加一列「產出目標」：number input（`type="number"` min 1 max 999，空字串=未啟用）＋ unit text input（`maxLength={8}`，placeholder「張 / 行 / 位」）。submit payload 加 `outputTarget: count>0 ? { count, unit: unit || "項" } : undefined`、`outputCount: 0`（編輯既有任務時改用 `initialData?.outputCount ?? 0` 保留原值）。沿用既有 `className="input"`，不新增全域樣式。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/components/TaskForm.tsx`，exit code 皆 0。
- **依賴**：Step 1。

## Step 7｜任務顯示：產出計數＋1

- **目標檔案**：`src/components/TaskCardToolbar.tsx`、`src/components/TaskDetailPanel.tsx`（2 個）
- **變更內容**：
  - `TaskCardToolbar.tsx`：新增 optional prop `onIncrementOutput?: () => void`。有 `task.outputTarget` 才渲染：`{formatOutputLabel(task.outputCount, task.outputTarget)}`（`text-[11px]`、`var(--text-tertiary)`、`tabular-nums`）＋「＋1」按鈕（沿用該檔既有 icon 按鈕樣式，`aria-label="產出加一"`，無 `onIncrementOutput` 時不渲染按鈕只顯示文字）。**禁止 red 系、禁止動畫、禁止驚嘆號。**
  - `TaskDetailPanel.tsx`：在「具體時間」區塊之後加同一組 UI，`handleUpdateTask(task.id, { outputCount: incrementOutputCount(task.outputCount) })`（`handleUpdateTask` 已存在於該檔第 147 行，支援 shared routing，直接沿用）。`handleSave` 的 payload 一併帶上 `outputTarget` / `outputCount`（編輯時保留原 `outputCount`）。
  - `TaskCard.tsx`（第 194 行）傳 `onIncrementOutput` 給 `TaskCardToolbar`：`onIncrementOutput={() => onUpdateOutput?.(task.id)}` — 需在 `TaskCard.tsx` 加 optional prop `onUpdateOutput?: (id: string) => void`，由上層 `AppShell`/`TaskListItem` 傳 `updateTask`。若上層接線成本過高，允許降級：只在 `TaskDetailPanel.tsx` 提供完整功能，`TaskCardToolbar.tsx` 僅顯示文字（此時 Step 7 仍成立，Step 7.5 記錄降級）。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/components/TaskCardToolbar.tsx src/components/TaskDetailPanel.tsx src/components/TaskCard.tsx`，exit code 皆 0。
- **依賴**：Step 3、Step 6。

## Step 8｜新建節奏條：RhythmBar

- **目標檔案**：`src/components/RhythmBar.tsx`（新建，1 個）
- **視覺規格**（對齊 Zen 既有語言，不搶焦點）：
  - 容器：`mx-auto max-w-2xl px-1`，單行 `flex items-center gap-2`，高度約 24px。
  - 視覺：`text-[11px]`、`color: var(--text-tertiary)`、`font-variant-numeric: tabular-nums`；**無背景色塊、無邊框、無卡片框**（與 Zen 頂部工具列同級的資訊層，不是卡片）。
  - 主題日 chip：`emoji + label`（如「💻 Vibe Coding」），無背景框，只有 emoji 與文字；若無今日主題則整段不渲染。
  - 當前錨點：僅在 `getActiveAnchor` 命中時顯示，文字前加一個 `w-1 h-1 rounded-full` 的 `var(--brand)` 小圓點（無動畫、無 pulse）。
  - MVD 開關：一個文字型小按鈕「低耗能」／「正常」，`aria-pressed` 標示狀態；選中態用 `var(--brand-tint)` 背景＋`var(--brand)` 文字（與專案既有 `ListChipPicker` chip 語言一致）。
  - MVD 進度條（僅 `mvdEnabled` 時）：`h-1 rounded-full` 軌道 `var(--surface-hover)`，內填 `var(--brand)`，寬度＝`min(100, pct)%`；**無數字百分比**、無紅色、無動畫（transition 限寬度 300ms）。
  - `reached` 時顯示一次 StatusWindow「今天的份完成了，剩下的都在這裡」（用 `useRef` 去重，StrictMode 下亦只一次）。
  - **不改視圖、不調 `order`、不開 modal**（§5a；§F1/F2/F3 全部不碰）。
- **props**：`{ visibleTasks: Task[] }`（由 Zen 傳入已算好的今日清單，本元件不做任務篩選）。內部讀 `useRhythmSettings()` ＋ `computeMvdProgress(visibleTasks.length, visibleTasks.filter(t => t.status === "done").length)` ＋ `getTodayTheme(settings, new Date())`。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/components/RhythmBar.tsx`，exit code 皆 0。
- **依賴**：Step 2、Step 3、Step 4。

## Step 9｜Zen 接入：插入 RhythmBar

- **目標檔案**：`src/components/ZenDashboard.tsx`（1 個）
- **變更內容**：只加兩處：頂部 import `RhythmBar`；在頂部工具列 `grid` 結束後插入 `<RhythmBar visibleTasks={visibleTasks} />`（外層加 `className="mx-auto max-w-2xl"`）。其餘邏輯零改動（`selectZenTasks`、`focusMode`、`shiftFocusWithNext` 全不動）。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/components/ZenDashboard.tsx`，exit code 皆 0。
- **依賴**：Step 8。

## Step 10｜下班閥門高亮：TodayWrapUpButton

- **目標檔案**：`src/components/TodayWrapUpButton.tsx`（1 個）
- **變更內容**：內部讀 `useRhythmSettings()` ＋ `isOffDutyNow(new Date(), settings)`；命中時按鈕加 `var(--brand-tint)` 背景＋文案後綴「・下班閥門」（仍無紅色、無驚嘆號）。點擊行為完全不變（沿用 `useProactiveClosure`）。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/components/TodayWrapUpButton.tsx`，exit code 皆 0。
- **依賴**：Step 2、Step 4。

## Step 11｜設定頁：RhythmSection（錨點 ＋ 主題日 ＋ MVD）

- **目標檔案**：`src/components/SettingsSections/RhythmSection.tsx`（新建）、`src/components/SettingsSections/index.ts`、`src/components/SettingsPage.tsx`（3 個）
- **變更內容**：
  - `RhythmSection.tsx` 三個區塊：
    1. **作息錨點**：三列（起床／下班／熄屏），每列一個 toggle ＋ `<input type="time">`。
    2. **每日主題日**：可新增（label text input ＋ emoji input ＋ 星期多選按鈕列，沿用 `TaskForm` 既有 `WEEKDAY_LABELS` 按鈕樣式：`w-9 h-9 rounded-xl text-[13px]`，選中＝`var(--brand)`）；已建立的主題日以 chip 列顯示（emoji＋label＋星期摘要＋刪除按鈕）。
    3. **低耗能模式**：一個 toggle，旁附一句說明「睡不好時開啟，今天完成兩成就算有份」。
  - 區塊頂部說明一行：「提醒一天只出現一次，關掉也沒關係」。
  - `index.ts` 加 barrel export；`SettingsPage.tsx` 在 `<InteractionSection />` 之後插入 `<RhythmSection />`（只加 import＋一行渲染）。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint` 三檔，exit code 皆 0。
- **依賴**：Step 4。

## Step 12｜統計頁：產出區 ＋ 主題日產出

- **目標檔案**：`src/components/StatsClient.tsx`（1 個）
- **變更內容**：在既有「核心快樂指標」網格之後加「產出」區（card，沿用既有 `card px-5 py-5` 樣式）：
  - 依 `outputTarget.unit` 分組加總 `outputCount`（只計有 target 的任務），每組一個中性數字（如「12 張」）。
  - 並列顯示 `focusMinutes` 總和（「專注 340 分」）。
  - 有主題日時，依 `themeDays[].tag` 過濾任務顯示各主題的任務完成數。
  - Free 鎖定邏輯不動（鎖定區內不加任何新內容）。
- **驗證**：`npx tsc --noEmit` ＋ `npx eslint src/components/StatsClient.tsx`，exit code 皆 0。
- **依賴**：Step 1、Step 7、Step 8。

## Step 13｜收尾：靜態總檢 ＋ 提交推送

- **目標檔案**：無（指令步驟）
- **變更內容**：依序執行，任一步 exit code 非 0 即停：
```bash
npx tsc --noEmit
npx eslint src/lib/rhythm.ts src/lib/mvd.ts src/lib/outputCount.ts src/hooks/useRhythmSettings.ts src/hooks/useRhythmAnchors.ts src/components/TaskForm.tsx src/components/TaskCardToolbar.tsx src/components/TaskDetailPanel.tsx src/components/TaskCard.tsx src/components/RhythmBar.tsx src/components/ZenDashboard.tsx src/components/TodayWrapUpButton.tsx src/components/SettingsSections/RhythmSection.tsx src/components/StatsClient.tsx src/components/AppProviders.tsx
npx vitest run src/__tests__/rhythm.test.ts src/__tests__/mvd.test.ts src/__tests__/outputCount.test.ts
git add -A
git commit -m "feat(rhythm): 節奏錨點+主題日+MVD+產出計數 [deploy: main]

🪞 Architect Mirror (this commit):
- [PASS] 無失序需要揭露"
git push
```
  `git push` 只准普通 push；出現 `--force` 需求一律停下等口頭確認（§11）。
- **依賴**：Step 1～12 全過。

---

## 實機驗收（用戶在已部署環境手動確認，非本地伺服器）

- [ ] 08:00 前後 10 分鐘內收到起床提醒一次；關掉開關後不再出現
- [ ] 17:00 後「今天先這樣」按鈕出現閥門高亮；點擊行為與之前一致
- [ ] 22:15 熄屏提醒一次，無強制鎖屏
- [ ] 設定頁設主題日「💻 Vibe Coding」到週一／三／五 → 週三打開 Zen，節奏條顯示「💻 Vibe Coding」；週二不顯示
- [ ] 關掉主題日 → 節奏條該段消失，其他內容不變
- [ ] Zen 開 MVD：進度條隨完成增長；達 20% 彈一次狀態窗；其餘任務仍在（只降噪不消失）
- [ ] 任務設產出目標「5 張」→ 卡片顯示 0/5 張 → 按＋1 變 1/5 → 重整後仍在（JSONB 同步）
- [ ] 設定頁時間改為 09:00 → 隔天提醒時間跟著變
- [ ] 另一台裝置登入同一帳號 → 主題日與錨點時間同步過來（雲端 upsert 生效）
- [ ] 離線改設定 → 恢復網路後雲端被覆蓋（本地優先，離線變更保留）
