# 方案 D（方案評分 9.3 / 10）：節奏槽網格 Day Slot Grid — 一眼看懂「幾點到幾點」

> **狀態**：⏳ 待落地（禁止跳步，依序執行 Step 0 → Step 14）
> **設計立場**：計畫是「班表」，產品是「節奏」。做「一天的節奏槽」，**不做**連續時間軸、**不做**週課表網格。
> **核心機制**：槽位邊界由**既有作息錨點**（起床 / 下班 / 熄屏）自動推導，任務依 `dueTime` 落進對應槽 → 一格 = 一段真實時間區間，回答「幾點到幾點」。
> **為什麼不是課表網格**：課表 = 固定節次 = 逼使用者編造時段；槽位 = 由自己真實作息推導 = 不編造。

---

## 0. 紅線（每一步都適用，違反即停）

1. **不新增 Supabase migration。** `personal_tasks.data` 是 JSONB（整個 `Task` 物件直接塞進去，見 `src/lib/personalTaskSync.ts` 的 `saveTask`），新增 optional 欄位 `durationMinutes` **不需要 migration**，舊資料不受影響（`undefined` = 未設定）。
2. **不碰 sync 層本體**：不修改 `personalTaskSync.ts`、`personalHabitSync.ts`、`sharedSync.ts`、`firestore.ts`（§23 已確認）。
3. **UI 文案禁用**：紅色系（`red-*` / `text-red-*` / `bg-red-*`）、驚嘆號（`!` `！`）、倒計時、抖動動畫、「過期」「逾期」「未完成」「失敗」「欠」「賴床」「空」「無安排」。
4. **流程鎖定（§5a）**：槽位卡片點擊**只做**「展開/收合該槽內容」。**絕不**改 `currentView`、**絕不**改 `order`（搶 Zen 焦點）、**絕不**開 modal / bottom sheet 阻擋後續操作（唯一例外：使用者點全域 CTA）。
5. **不新增 cron / setInterval 自動刪除或自動標記過期**（§5）。
6. **不碰這些檔案**：`LostAndFound.tsx`、`usePomodoro.ts`、`completionSound.ts`、`ZenFlowProvider.tsx`、`FlowTimer.tsx`、`useZenFlow.ts`。
7. **不新增相依套件**。只用既有 `date-fns`、`lucide-react`、`clsx`（若專案已有；沒有就用 template string）。
8. **每步驗證只准**：`npx tsc --noEmit`、`npx vitest run <檔案>`；Step 13 追加 `npm run build`。
   **本專案沒有 ESLint 設定**（無 `eslint.config.js` / `.eslintrc`，`next lint` 已 deprecated）→ **不要跑 `npx eslint`**（會因缺少 config 直接失敗）。**嚴禁** `npm run dev`、**嚴禁**啟動任何本地伺服器或佔用 Port。
9. **不要動 `task.md` 本檔以外的文件**（`優化清單.md` 只在 Step 14 更新）。

---

## 步驟總覽

| Phase | Step | 目標 | 檔案數 |
|---|---|---|---|
| A 純邏輯 | 1 | 型別：`durationMinutes` + 槽位型別 | 1 |
| A 純邏輯 | 2 | 純函式：槽位推導 `daySlots.ts` | 1 |
| A 純邏輯 | 3 | 純函式：任務歸槽 `taskSlots.ts` | 1 |
| A 純邏輯 | 4 | 文案常數 + 單元測試（3 檔） | 4 |
| B UI | 5 | `SlotTaskRow.tsx`（槽內任務列） | 1 |
| B UI | 6 | `DaySlotCard.tsx`（單一槽外框） | 1 |
| B UI | 7 | `DaySlotGrid.tsx`（槽網格容器） | 1 |
| B UI | 8 | 接入 ZenDashboard | 1 |
| C 資料 | 9 | TaskForm 加 duration 輸入 | 1 |
| C 資料 | 10 | TaskDetailPanel 加 duration 輸入 | 1 |
| C 資料 | 11 | 修 `webcal` 的 DTEND 零長度 bug | 1 |
| D 整合 | 12 | 設定頁：可關閉槽網格 | 4 |
| D 整合 | 13 | 收尾：靜態總檢 | 0 |
| D 整合 | 14 | 更新 `優化清單.md` + commit + push | 1 |

---

## Phase A｜純邏輯（無 UI，先確保邏輯正確）

### Step 1｜型別

- **目標檔案**：`src/lib/types.ts`（改 1 個）
- **變更內容**：
  1. 在 `Task` interface 內，`outputCount?: number;` 那一行**之後**新增一行：
```ts
durationMinutes?: number; // 時段長度（分鐘）；與 dueTime 搭配形成「幾點到幾點」；undefined = 只知道開始時刻
```
  2. 在檔尾（`RhythmProfile` interface 之後）追加：
```ts
/** 一天的節奏槽（由作息錨點推導，非使用者手動輸入） */
export interface DaySlot {
  id: string;          // 穩定 id，如 "slot-0"
  label: string;       // 顯示用區段名，如 "上午"
  startMin: number;    // 自午夜起分鐘數，含
  endMin: number;      // 自午夜起分鐘數，不含
}
```
- **驗證**：`npx tsc --noEmit` → **讀完整 stderr + exit code**；只允許殘留 `src/__tests__/logger.test.ts` 的既有 `NODE_ENV` 錯誤，其餘 0 error 才算過（§12）。
- **依賴**：無。

---

### Step 2｜純函式：槽位推導 `src/lib/daySlots.ts`（新建）

- **目標檔案**：`src/lib/daySlots.ts`（新建 1 個）
- **約束**：純函式。**不 import React**、**不讀 localStorage**、**不 import 任何 hook**。只准 import `@/lib/types` 與 `@/lib/rhythm`（用它的 `parseHHmm`）。
- **匯出**：
```ts
export const DEFAULT_SLOT_COUNT = 4;
export const MIN_SLOT_COUNT = 2;
export const MAX_SLOT_COUNT = 6;

/** 由作息錨點推導一天分幾段。回傳 null 表示設定不合理（例如 offDuty <= wake）。 */
export function deriveSlotBoundaries(s: RhythmSettings, slotCount?: number): { startMin: number; endMin: number }[] | null;

/** 推導今日槽位清單（帶 label）。 */
export function buildDaySlots(s: RhythmSettings, slotCount?: number): DaySlot[];

/** 某個時刻落在哪一個槽（回傳 index）。超出範圍回 -1。 */
export function findSlotIndex(slots: DaySlot[], minutesSinceMidnight: number): number;

/** 槽的區間標籤，如 "08:00 – 11:00"（用 24 小時制、零填充）。 */
export function formatSlotRange(slot: DaySlot): string;

/** 槽的區段名（依起始時刻判斷：<12 上午、<17 下午、其餘 晚上；跨午夜時以 endMin 判斷）。 */
export function slotLabelFor(startMin: number, endMin: number): string;
```
- **具體規則（低階模型照抄，不要自由發揮）**：
  1. `startMin` = `parseHHmm(s.wakeTime)`；`endMin` = `parseHHmm(s.screensOffTime)`。
  2. 若 `startMin === null` 或 `endMin === null` → 回傳 `null`（呼叫端必須 fallback）。
  3. 若 `endMin <= startMin`（跨午夜，例如起床 23:00、熄屏 01:00）→ 視為跨日，直接回傳 `null`（**不做跨日槽**，避免複雜度與視覺混亂）。
  4. 槽數 = `slotCount ?? DEFAULT_SLOT_COUNT`；夾在 `[MIN_SLOT_COUNT, MAX_SLOT_COUNT]` 之間。
  5. 邊界 = 從 `startMin` 到 `endMin` **等分** `slotCount` 段。`i` 段為 `[startMin + round(i * span / n), startMin + round((i+1) * span / n))`，`span = endMin - startMin`。用 `Math.round` 取整，確保相鄰槽**不重疊不遺漏**（前一槽的 `endMin` 必須等於後一槽的 `startMin`）。
  6. `slotCount >= 2` → 槽長度 = `span / n`，若 `span < slotCount`（槽長不足 1 分鐘）→ 回傳 `null`。
  7. `label` 由 `slotLabelFor(startMin, endMin)` 決定；**同一個 label 不得重複**（例如 08:00–17:00 分 4 段會出現兩個「上午」）→ 若重複，改用 `上午 / 下午 / 傍晚 / 晚上` 順序詞：依 index 取 `["上午", "下午", "傍晚", "晚上", "深夜", "清晨"]` 循環取用（長度 6，涵蓋 MAX_SLOT_COUNT=6）。
  8. `id` = `slot-${i}`（i 為 index，穩定不隨時間變動）。
- **驗證**：`npx tsc --noEmit`（同 Step 1 標準）。
- **依賴**：Step 1。

---

### Step 3｜純函式：任務歸槽 `src/lib/taskSlots.ts`（新建）

- **目標檔案**：`src/lib/taskSlots.ts`（新建 1 個）
- **約束**：純函式，不 import React / hook。只准 import `@/lib/types`。
- **匯出**：
```ts
export interface SlotAssignment {
  task: Task;
  slotIndex: number;      // -1 = 無法歸槽（沒有 dueTime，或落在槽範圍外）
  startMin: number;       // 任務起始分鐘（由 dueTime 解析）
  endMin: number | null;  // 任務結束分鐘（durationMinutes 存在才有，否則 null）
}

/** 解析 "HH:mm" → 分鐘數；非法回 null。 */
export function parseTaskTime(t: Task): number | null;

/** 計算任務的結束分鐘：dueTime + durationMinutes。durationMinutes 缺少或 <= 0 → null。 */
export function taskEndMinutes(t: Task): number | null;

/** 把任務指派到槽位。回傳 { slotIndex, startMin, endMin }。 */
export function assignTaskToSlot(t: Task, slots: DaySlot[]): { slotIndex: number; startMin: number; endMin: number | null };

/** 把一批任務依槽分組。回傳陣列長度 = slots.length，每格是該槽的任務（已排序）。 */
export function groupTasksBySlot(tasks: Task[], slots: DaySlot[]): SlotAssignment[][];

/** 槽內排序：有 dueTime 的先排（有時間的更明確），同時間依 order 升序，無 dueTime 的最後依 order 升序。 */
export function sortSlotTasks(list: SlotAssignment[]): SlotAssignment[];

/** 產生任務的時間顯示文字：
 *  - 無 dueTime → ""
 *  - 有 dueTime 無 duration → "09:30"
 *  - 有 dueTime 有 duration → "09:30 – 10:30"
 */
export function formatTaskTimeRange(t: Task): string;
```
- **具體規則**：
  1. `parseTaskTime`：`t.dueTime` 為 `"HH:mm"`（兩位數小時 + 冒號 + 兩位數分鐘）→ 回分鐘數；格式不符回 `null`。
  2. `taskEndMinutes`：`durationMinutes` 存在且 `> 0` → `startMin + durationMinutes`；否則 `null`。**不假造結束時間**。
  3. `assignTaskToSlot`：`startMin` = `parseTaskTime(t)`；若 `null` → `{ slotIndex: -1, startMin: -1, endMin: null }`。若有 `startMin`，找第一個滿足 `startMin >= slot.startMin && startMin < slot.endMin` 的槽 → 其 index；若都沒命中 → `slotIndex: -1`（落在槽範圍外的時間，例如凌晨 3 點）。
  4. `groupTasksBySlot`：`slots.length` 個空陣列；逐個任務呼叫 `assignTaskToSlot`，`slotIndex >= 0` 才放入該槽；其餘（`slotIndex === -1`）**不丟棄**，另外提供 `export function groupUnassignedTasks(tasks: Task[], slots: DaySlot[]): Task[]` 給呼叫端決定怎麼處理（預設在 UI 上放到「這段之外」提示列）。
  5. `sortSlotTasks`：**依 `order` 欄位排序**（§V：reorder / drag 類 selector 必須 sort by `order`）。規則：先比 `dueTime`（都有 → 早的先；只有一個有 → 有 dueTime 的先）；`dueTime` 相同或都無 → 比 `order` 升序。
  6. `formatTaskTimeRange`：`dueTime` 已是 "HH:mm" 格式，直接用；結束時間 = `startMin + durationMinutes` → 轉回 "HH:mm"（`String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0")`）。若結束分鐘 >= 1440，不跨日顯示，直接顯示原始 `dueTime`（不假造）。
- **驗證**：`npx tsc --noEmit`（同 Step 1 標準）。
- **依賴**：Step 1、Step 2。

---

### Step 4｜文案常數 ＋ 單元測試（4 檔新建）

- **目標檔案**：`src/lib/slotCopy.ts`（新建）、`src/__tests__/daySlots.test.ts`、`src/__tests__/taskSlots.test.ts`、`src/__tests__/slotCopy.test.ts`（新建 3 個測試）
- **`src/lib/slotCopy.ts`（本 Step 內新建）**：
```ts
export const SLOT_EMPTY_COPY = "這段留給你";
export const SLOT_UNASSIGNED_COPY = "這段之外";
export const SLOT_GRID_TITLE = "一天的節奏";
export const SLOT_FOLDED_HINT = "點一下展開";
export const SLOT_UNFOLDED_HINT = "點一下收合";
export const SLOT_DURATION_LABEL = "這件事要花多久";
```
  - 這是**唯一的文案來源**，之後所有元件都從這裡 import，**不要在元件裡硬寫字串**。
- **`daySlots.test.ts`**（每條一個 `it`）：
  - `buildDaySlots(DEFAULT_RHYTHM_SETTINGS)` 回傳 4 個槽。
  - 第一槽 `startMin` = `parseHHmm("08:00")` = 480；最後一槽 `endMin` = `parseHHmm("22:15")` = 1335。
  - 相鄰槽邊界連續：對每個 i，`slots[i].endMin === slots[i+1].startMin`。
  - 每槽 `endMin > startMin`。
  - `deriveSlotBoundaries` 在 `wakeTime = "22:00"`（晚於 screensOffTime 22:15 的前一格，實際會讓 endMin <= startMin）時回傳 `null`。**測試時用 `wakeTime: "23:00"`、`screensOffTime: "01:00"`（跨午夜）→ 必須回 `null`**；另測 `wakeTime: "23:30"`、`screensOffTime: "22:15"`（end <= start）→ 回 `null`。
  - `buildDaySlots` 的 `label` 不得重複（`new Set(labels).size === labels.length`）。
  - `findSlotIndex(slots, 480)` = 0；`findSlotIndex(slots, 1335)` = -1（超出最後一槽的 endMin）；`findSlotIndex(slots, -1)` = -1。
  - `formatSlotRange` 用**自建 slot** 測固定字串（不要依賴 DEFAULT 的等分結果）：`formatSlotRange({ id: "x", label: "上午", startMin: 480, endMin: 660 })` = `"08:00 – 11:00"`。
- **`taskSlots.test.ts`**：
  - `parseTaskTime({...task, dueTime: "09:30"})` = 570；`dueTime: "9:30"`（非兩位數）→ null；`dueTime: undefined` → null。
  - `taskEndMinutes({...task, dueTime: "09:30", durationMinutes: 60})` = 630；`durationMinutes: 0` → null；`durationMinutes: undefined` → null。
  - `assignTaskToSlot` 對 `dueTime: "09:30"` 且 DEFAULT 槽 → `slotIndex` = 0（09:30 = 570 分，在 480–693 內）。
  - `assignTaskToSlot` 對 `dueTime: "03:00"` → `slotIndex` = -1（槽範圍外）。
  - `groupTasksBySlot` 回傳陣列長度 = `slots.length`；放入 3 個任務後，各槽總數 + `groupUnassignedTasks` 的總數 = 3。
  - `sortSlotTasks`：`order` 大但 `dueTime` 早的排在前面；`dueTime` 相同時 `order` 小的在前。
  - `formatTaskTimeRange`：
    - 無 dueTime → `""`
    - 有 dueTime 無 duration → `"09:30"`
    - 有 dueTime 有 duration 60 → `"09:30 – 10:30"`
- **`slotCopy.test.ts`**：測試 UI 文案常數（從 `@/lib/slotCopy` import）：
  - 測試斷言：以上所有字串**不含** `!`、`！`、`過期`、`逾期`、`未完成`、`失敗`、`欠`、`賴床`、`空`、`無安排`。
  - 測試斷言：`SLOT_EMPTY_COPY` 包含 `"留給你"`。
- **驗證**：
```bash
npx vitest run src/__tests__/daySlots.test.ts src/__tests__/taskSlots.test.ts src/__tests__/slotCopy.test.ts
npx tsc --noEmit
```
  → **讀完整 stdout**，必須顯示全部 passed、exit code 0；tsc 同 Step 1 標準。
- **依賴**：Step 2、Step 3。

---

## Phase B｜UI（只讀取，不寫入）

### Step 5｜`src/components/SlotTaskRow.tsx`（新建）

- **目標檔案**：`src/components/SlotTaskRow.tsx`（新建 1 個）
- **props**：
```ts
interface SlotTaskRowProps {
  task: Task;
  timeLabel: string;      // 由 formatTaskTimeRange 產生，可能為 ""
  isDone: boolean;
  onToggleStatus?: () => void;
}
```
- **視覺規格**（沿用專案既有 CSS token，**禁 red 系、禁動畫、禁驚嘆號**）：
  - 容器：`flex items-center gap-2 px-2 py-1.5 rounded-lg`；背景 `var(--surface-muted)`；hover 時背景 `var(--surface-hover)`。
  - 完成勾選圓圈：`w-[16px] h-[16px] rounded-full`，未完成＝`border-2` + `borderColor: var(--border-hover)`；已完成＝`background: var(--status-success)`。點擊切換 status。**不用紅色**。
  - 任務標題：`text-[13px]`，`style={{ color: "var(--text-primary)" }}`；已完成時加 `line-through` 且 `color: var(--text-tertiary)`。
  - 時間文字：`text-[11px] tabular-nums`，`color: var(--text-tertiary)`，`whitespace-nowrap`。**無 timeLabel 時整段不渲染**（不顯示空的時間欄位）。
  - **不畫 priority 圓點**（`do-now` 的 `#D70015` 是紅色，違反 §5 情緒保護；此元件只靠「時間 + 標題」辨識任務）。
  - 整列**不可點擊**（Zen 沒有詳情面板，開 modal 會違反 §5a）→ **不要**加 `onClick`、不要加 `cursor-pointer`。唯一可點的是完成勾選圓圈。
- **不做**：不開 modal、不改 `order`、不改視圖（§5a）。
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 3、Step 4。

---

### Step 6｜`src/components/DaySlotCard.tsx`（新建）

- **目標檔案**：`src/components/DaySlotCard.tsx`（新建 1 個）
- **props**：
```ts
interface DaySlotCardProps {
  slot: DaySlot;
  tasks: SlotAssignment[];
  isCurrent: boolean;        // 當下時刻是否落在這個槽
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleStatus?: (taskId: string) => void;
}
```
- **視覺規格**：
  - 外框：`rounded-xl px-3 py-2.5`；背景 `var(--surface)`；邊框 `1px solid var(--border)`。
  - 標題列：`flex items-center justify-between gap-2`。
    - 左側：`slot.label`（`text-[12px] font-medium`，`color: var(--text-secondary)`）＋ `formatSlotRange(slot)`（`text-[11px] tabular-nums`，`color: var(--text-tertiary)`），以 ` · ` 分隔。
    - 右側：任務數量徽章 `N`（`text-[10px]`，`background: var(--brand-tint)`，`color: var(--brand)`，`rounded-full px-1.5`）。**無任務時不渲染徽章**（避免「0」的指責感）。
    - **當下槽**（`isCurrent`）：標題左側加一個 `w-1.5 h-1.5 rounded-full` 小圓點，`background: var(--brand)`，**無 pulse、無動畫**。
  - 展開狀態（`isCollapsed === false`）：任務列由 `SlotTaskRow` 渲染，`space-y-1`。
  - 收合狀態（`isCollapsed === true`）：**不顯示任何空狀態文字**（收合就是收合）；可顯示 `SLOT_FOLDED_HINT`（"點一下展開"）作為 `title` 屬性（非可見文字）。
  - **空槽（有槽位但無任務）且展開時**：顯示 `SLOT_EMPTY_COPY`（"這段留給你"），`text-[12px]`，`color: var(--text-tertiary)`。**禁止**出現「空」「無安排」「沒有任務」等字樣。
  - 點擊標題列 = `onToggleCollapsed`（收合/展開該槽）。**只影響本地展開狀態**，不改視圖、不改任務。
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 5。

---

### Step 7｜`src/components/DaySlotGrid.tsx`（新建）

- **目標檔案**：`src/components/DaySlotGrid.tsx`（新建 1 個）
- **props**：
```ts
interface DaySlotGridProps {
  tasks: Task[];             // 已篩選為「今天」且未完成的任務
  onToggleStatus?: (taskId: string) => void;
}
```
- **內部邏輯**：
  1. `const { settings, isHydrated } = useRhythmSettings();`
  2. `const slots = useMemo(() => (isHydrated ? buildDaySlots(settings) : []), [isHydrated, settings]);`
  3. `const assignments = useMemo(() => groupTasksBySlot(tasks, slots), [tasks, slots]);`
  4. `const unassigned = useMemo(() => groupUnassignedTasks(tasks, slots), [tasks, slots]);`
  5. 當下槽判定：`const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes(); const currentIndex = findSlotIndex(slots, nowMin);`
  6. 收合狀態：`const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});`（key = slot.id）。**預設全部展開**（`collapsed[id] ?? false`）。
  7. **空狀態**：若 `tasks.length === 0` → 不渲染整個網格（回傳 `null`），讓上層版面保持乾淨。
  8. **渲染結構**：
```tsx
<section aria-label={SLOT_GRID_TITLE} className="flex flex-col gap-2">
  <div className="flex items-center justify-between gap-2 px-1">
    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{SLOT_GRID_TITLE}</span>
  </div>
  {slots.map((slot, i) => (
    <DaySlotCard
      key={slot.id}
      slot={slot}
      tasks={assignments[i] ?? []}
      isCurrent={i === currentIndex}
      isCollapsed={collapsed[slot.id] ?? false}
      onToggleCollapsed={() => setCollapsed((prev) => ({ ...prev, [slot.id]: !(prev[slot.id] ?? false) }))}
      onToggleStatus={onToggleStatus}
    />
  ))}
  {unassigned.length > 0 && (
    <div className="px-3 py-2.5 rounded-xl space-y-1" style={{ background: "var(--surface-muted)" }}>
      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{SLOT_UNASSIGNED_COPY}</span>
      {unassigned.map((t) => (
        <SlotTaskRow
          key={t.id}
          task={t}
          timeLabel={formatTaskTimeRange(t)}
          isDone={t.status === "done"}
          onToggleStatus={onToggleStatus ? () => onToggleStatus(t.id) : undefined}
        />
      ))}
    </div>
  )}
</section>
```
  9. **不做**：不開 modal、不改視圖、不改 `order`、不自動展開任何任務（§5a）。
  10. **不做**：「現在要做什麼」的自動高亮跳轉。當下槽只加一個靜態小圓點即可。
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 6。

---

### Step 8｜接入 ZenDashboard

- **目標檔案**：`src/components/ZenDashboard.tsx`（改 1 個）
- **背景說明（重要）**：`ZenDashboard` **沒有**任務詳情面板，也**沒有** `selectTask`。`useApp()` 在此檔只解構了 `tasks, toggleTaskStatus, completeTask, reorderTasks, saveTasksDirectly, updateTask, escapeTask, sharedLists, updateSharedTask`（約第 78 行）。
  → 因此 **SlotTaskRow 的 `onOpen` 一律不傳**（`undefined`）。槽內任務列只提供「勾選完成」與「顯示時間」兩個動作。**絕對不要**為了開詳情而引入新 modal / 改 `currentView`（§5a）。
- **變更內容**（只加 3 處，其餘零改動）：
  1. 頂部 import：`import { DaySlotGrid } from "@/components/DaySlotGrid";`
  2. 在既有的 `<RhythmBar visibleTasks={visibleTasks} />` **下方**插入：
```tsx
      <div className="mx-auto mt-3 max-w-2xl">
        <DaySlotGrid
          tasks={visibleTasks}
          onToggleStatus={(id) => handleToggleTaskStatus(id)}
        />
      </div>
```
     - `handleToggleTaskStatus` 是此檔既有 的 `useCallback`（約第 85 行），簽章 `(taskId: string) => void`，且已處理 shared task 分流 → **直接用它**，不要直接用 `toggleTaskStatus`（那會漏掉 shared 任務）。
  3. **不傳 `onOpenTask`**。
- **注意**：`visibleTasks` 已由 `selectZenTasks` 過濾為「今天 + 未完成 + 無子任務 + 依 `order` 排序」，**直接餵給 DaySlotGrid 即可，不要另外篩選**。
- **注意**：不要動 `focusMode`、`queue`、`shiftFocusWithNext`、`focus`（第一個任務）等任何既有邏輯。
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 7。

---

## Phase C｜補齊「到幾點」（資料欄位）

### Step 9｜TaskForm 加 duration 輸入

- **目標檔案**：`src/components/TaskForm.tsx`（改 1 個）
- **變更內容**：
  1. 新增 state：`const [durationMinutes, setDurationMinutes] = useState("");`（放在 `outputTargetUnit` state 之後）。
  2. `initialData` 回填時（既有 `setOutputTargetUnit(initialData.outputTarget?.unit || "")` 那一區塊之後）新增：
```ts
      setDurationMinutes(initialData.durationMinutes ? String(initialData.durationMinutes) : "");
```
  3. submit payload（既有 `outputTarget: ...` / `outputCount: 0` 那一區塊附近）新增：
```ts
      durationMinutes: durationMinutes ? Math.max(1, Math.min(1440, Number(durationMinutes))) : undefined,
```
     （`Number()` 結果若為 `NaN` → 寫 `undefined`；用 `Number.isFinite` 保護。）
  4. UI：在「產出目標」區塊**之後**新增一區塊：
```tsx
                <div>
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>{SLOT_DURATION_LABEL}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="分鐘（選填）"
                      className="input"
                    />
                    <div className="flex items-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      填了才會顯示「幾點到幾點」
                    </div>
                  </div>
                </div>
```
     - 匯入 `SLOT_DURATION_LABEL` 從 `@/lib/slotCopy`。
     - 這段說明文字**不含**禁用語。
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 4（`slotCopy.ts` 已存在）。

---

### Step 10｜TaskDetailPanel 加 duration 輸入

- **目標檔案**：`src/components/TaskDetailPanel.tsx`（改 1 個）
- **變更內容**：
  1. 新增 state：`const [durationMinutes, setDurationMinutes] = useState(task.durationMinutes ? String(task.durationMinutes) : "");`
  2. 任務切換時的重新同步區塊（既有 `setOutputTargetUnit(task.outputTarget?.unit || "")` 附近）新增：
```ts
    setDurationMinutes(task.durationMinutes ? String(task.durationMinutes) : "");
```
  3. `hasChanges` 判定（既有 `outputTargetUnit !== (task.outputTarget ? String(task.outputTarget.count) : "")` 那一串）新增：
```ts
    durationMinutes !== (task.durationMinutes ? String(task.durationMinutes) : "") ||
```
  4. `handleSave` 的 payload 新增：`durationMinutes: durationMinutes ? Math.max(1, Math.min(1440, Number(durationMinutes))) : undefined,`
  5. debounce：既有 `useDebouncedField({ value: outputTargetUnit, ... })` 附近新增 `useDebouncedField({ value: durationMinutes, onCommit: bumpDebounced, delay: DEBOUNCE_MS });`
  6. UI：在「產出目標」區塊之後新增同 Step 9 的 duration 輸入（值綁 `durationMinutes`）。
  7. 若 `handleUpdateTask` 已支援 partial update（該檔第 147 行附近），可在輸入時直接 `handleUpdateTask(task.id, { durationMinutes })` 做即時儲存；**但**若該檔採用「編輯器 + 儲存鈕」模式，**只走 `handleSave`**，不要兩邊都寫（避免雙寫入）。
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 9。

---

### Step 11｜修 webcal 的 DTEND 零長度 bug

- **目標檔案**：`src/app/api/calendar/webcal/route.ts`（改 1 個）
- **現況 bug**：有 `dueTime` 時 `DTSTART === DTEND`（零長度事件，外部日曆看不到結束）。
- **變更內容**：把
```ts
      const startDt = `${format(due, "yyyyMMdd'T'")}${task.dueTime.replace(":", "")}00`;
      const endDt = `${format(due, "yyyyMMdd'T'")}${task.dueTime.replace(":", "")}00`;
```
  改為
```ts
      const startDt = `${format(due, "yyyyMMdd'T'")}${task.dueTime.replace(":", "")}00`;
      const duration = task.durationMinutes && task.durationMinutes > 0 ? task.durationMinutes : 60;
      const endDt = format(addMinutes(parse(`${format(due, "yyyyMMdd")}T${task.dueTime}`, "yyyyMMdd'T'HH:mm", new Date()), duration), "yyyyMMdd'T'HHmmss");
```
  - 匯入：`import { format, parseISO, parse, addMinutes } from "date-fns";`（`parseISO` 已存在，保留）。
  - **無 `durationMinutes` 時 fallback 60 分鐘**（此檔本來就是「有時間 → 時段事件」，60 分鐘是合理預設；不影響 `src/lib/ical.ts` 的既有行為）。
  - 若 `parse` 結果 `isValid` 為 false → fallback 成 `startDt`（保持原行為，不讓整個 feed 壞掉）。
- **不要動** `src/lib/ical.ts`（它的 timed event 已經用固定 3600000ms = 60 分鐘，行為一致，不需改）。
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 1。

---

## Phase D｜整合與收尾

### Step 12｜設定頁：可關閉槽網格

- **目標檔案**：`src/lib/types.ts`（改 1 個）、`src/hooks/useRhythmSettings.ts`（改 1 個）、`src/components/SettingsSections/RhythmSection.tsx`（**改既有檔案，不要重寫**）、`src/components/ZenDashboard.tsx`（改 1 個）
- **前置確認（必須先做）**：`src/components/SettingsSections/RhythmSection.tsx` **已存在**且 `SettingsPage.tsx` **已 import 並渲染** `<RhythmSection />`（約第 181 行）。**不要**重新建立該檔、**不要**重複在 `SettingsPage.tsx` 加 `<RhythmSection />`、**不要**動 `SettingsSections/index.ts` 的 barrel export。
  既有 `RhythmSection.tsx` 已有三個區塊（作息錨點 / 每日主題日 / 低耗能模式）＋ 一個「已套用方案安全退場」區塊。**只在「低耗能模式」區塊之後新增一個 toggle 區塊**，其餘保持原樣。
- **變更內容**：
  1. `src/lib/types.ts`：
     - `RhythmSettings` interface 新增 `slotGridEnabled: boolean;`
     - `DEFAULT_RHYTHM_SETTINGS` 新增 `slotGridEnabled: true,`
  2. `src/hooks/useRhythmSettings.ts`：
     - `normalizeSettings` 內新增一行：`slotGridEnabled: typeof obj.slotGridEnabled === "boolean" ? obj.slotGridEnabled : DEFAULT_RHYTHM_SETTINGS.slotGridEnabled,`
     - `UseRhythmSettingsReturn` interface 新增 `toggleSlotGrid: () => void;`
     - 實作（放在 `toggleMvd` 旁邊）：
```ts
  const toggleSlotGrid = useCallback(() => {
    commit((prev) => ({ ...prev, slotGridEnabled: !prev.slotGridEnabled }));
  }, [commit]);
```
     - 在 `return { ... }` 加上 `toggleSlotGrid,`
  3. `src/components/SettingsSections/RhythmSection.tsx`：
     - 從 `useRhythmSettings()` 的解構加入 `toggleSlotGrid`。
     - 在「低耗能模式」的 `<div className="card p-4">` **之後**新增：
```tsx
        {/* 一天的節奏槽網格 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                一天的節奏
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                用一天的節奏槽看今天要做什麼
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.slotGridEnabled}
                onChange={toggleSlotGrid}
                aria-label="啟用一天的節奏槽網格"
              />
              <div className="w-11 h-6 rounded-full peer peer-checked:bg-brand bg-black/10 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>
        </div>
```
     - 視覺必須與既有「低耗能模式」toggle **完全一致**（同一套 `card p-4` + `w-11 h-6` toggle 樣式）。說明文字不含禁用語。
  4. `src/components/ZenDashboard.tsx`：
     - 在檔案頂部 import：`import { useRhythmSettings } from "@/hooks/useRhythmSettings";`
     - 在 `ZenDashboard()` 函式內取得：`const { settings } = useRhythmSettings();`
     - 把 Step 8 插入的 `<DaySlotGrid ... />` 外包條件：
```tsx
      {settings.slotGridEnabled && (
        <div className="mx-auto mt-3 max-w-2xl">
          <DaySlotGrid
            tasks={visibleTasks}
            onToggleStatus={(id) => handleToggleTaskStatus(id)}
          />
        </div>
      )}
```
- **驗證**：`npx tsc --noEmit`。
- **依賴**：Step 8、Step 9。

---

### Step 13｜收尾：靜態總檢 ＋ build

- **目標檔案**：無（指令步驟）
- **變更內容**：依序執行，任一步 exit code 非 0 即停：
```bash
npx tsc --noEmit
npm run build
npx vitest run src/__tests__/daySlots.test.ts src/__tests__/taskSlots.test.ts src/__tests__/slotCopy.test.ts src/__tests__/rhythm.test.ts src/__tests__/mvd.test.ts src/__tests__/outputCount.test.ts
```
  → **讀完整 stdout/stderr**，必須顯示全部 passed、exit code 0（§12）。
- **依賴**：Step 1～12 全過。

---

### Step 14｜更新 SSOT ＋ commit ＋ push

- **目標檔案**：`優化清單.md`（改 1 個）
- **變更內容**：
  1. 在 `優化清單.md` 檔頭新增一節：
```md
---

# TaskFlow 節奏槽網格（方案 D，評分 9.3 / 10）

> **狀態**：✅ 完成（commit 待 push）
> 時間：2026-11-16

## ✅ 已經做完

| # | 任務 | 驗證 |
|---|---|---|
| 1 | `Task.durationMinutes` 欄位（JSONB，免 migration） | ✅ tsc clean |
| 2 | `daySlots.ts` 槽位推導（由作息錨點自動切分一天） | ✅ vitest passed |
| 3 | `taskSlots.ts` 任務歸槽 + 時間區間格式化 | ✅ vitest passed |
| 4 | `DaySlotGrid` / `DaySlotCard` / `SlotTaskRow` 三元件 | ✅ tsc clean |
| 5 | 接入 ZenDashboard（RhythmBar 下方） | ✅ |
| 6 | TaskForm / TaskDetailPanel 加 duration 輸入 | ✅ |
| 7 | 修 webcal `DTEND` 零長度 bug | ✅ |
| 8 | 設定頁「一天的節奏」開關 | ✅ |

## 🪞 Architect Mirror

- [PASS] 無新失序揭露
```
  2. 執行：
```bash
git add -A
git commit -m "feat(slots): 一天的節奏槽網格 [deploy: main]

🪞 Architect Mirror (this commit):
- [PASS] 無失序需要揭露"
git push
```
  3. `git push` 只准普通 push；出現 `--force` 需求**一律停下等口頭確認**（§11）。
- **依賴**：Step 13 全過。

---

## 實機驗收（用戶在已部署環境手動確認，非本地伺服器）

- [ ] 打開 Zen → `RhythmBar` 下方出現「一天的節奏」槽網格，槽數 = 4
- [ ] 槽的時間區間由起床 08:00 與熄屏 22:15 推導，顯示為「08:00 – 11:33」等
- [ ] 一個 `dueTime = "09:30"` 的今日任務落在第一槽
- [ ] 一個 `dueTime = "03:00"` 的今日任務出現在「這段之外」
- [ ] 一個沒有 `dueTime` 的今日任務出現在「這段之外」
- [ ] 當下時刻所在的槽標題左側有一個靜態小圓點（無動畫、無脈衝）
- [ ] 點槽標題列可收合/展開該槽（**不改視圖、不彈視窗、不改任務順序**）
- [ ] 沒有任務的槽顯示「這段留給你」，**沒有**任何紅色 / 驚嘆號 / 「空」 / 「未完成」字樣
- [ ] 任務加 `durationMinutes = 60` → 槽內任務列顯示「09:30 – 10:30」
- [ ] `durationMinutes` 沒填 → 只顯示「09:30」，**不假造結束時間**
- [ ] TaskForm 填 duration → 儲存 → 重整後仍在（JSONB 同步生效）
- [ ] 另一台裝置登入同一帳號 → duration 同步過來
- [ ] 設定頁關掉「一天的節奏」→ Zen 不再顯示槽網格；再開 → 恢復
- [ ] 匯出 `.ics` → 有 duration 的任務在 Google Calendar 顯示正確的結束時間（不再是零長度）

---

## 給低階模型的執行守則（重要）

1. **一次只做一個 Step**，做完 Step 就跑該 Step 的驗證指令，**讀完整輸出**再進下一步（§12）。
2. **不要自由發揮 UI**。上面每個 Step 都給了具體的 className / CSS token / 文案，照抄。視覺語言必須對齊 `RhythmBar.tsx`（`text-[11px]`、`var(--text-tertiary)`、`tabular-nums`、無背景框的資訊層風格）。
3. **不要新增依賴套件**，不要改 `package.json`。
4. **不要刪除既有功能**。若某個既有檔案的結構與本方案描述不符（例：`RhythmSection.tsx` 已存在且內容不同），**停下來在回覆中說明**，不要硬改。
5. **每個 Step 的 `tsc --noEmit` 必須讀完整 stderr + exit code**。只要有非 logger.test.ts 的既有錯誤就停下回報。
6. **不要碰**：`LostAndFound.tsx`、`usePomodoro.ts`、`completionSound.ts`、`ZenFlowProvider.tsx`、`FlowTimer.tsx`、`personalTaskSync.ts`、`personalHabitSync.ts`、`sharedSync.ts`、`firestore.ts`。
7. **不要**在槽網格裡加倒計時、紅色、驚嘆號、抖動動畫、auto-delete、auto-archive。
8. **不要**自動把任務排進槽位（絕不自動改 `dueTime` / `dueDate` / `order` / `priority`）。
9. **遇到無法判斷的地方**：停下、說明「哪一步、哪個檔案、為什麼不確定、你會怎麼做」，等指示。不要猜。
