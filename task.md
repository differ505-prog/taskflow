# Bug 修復實作清單

> 日期：2026-09-24
> 目標：Bug 1（開始日期變更時自動順移結束日期）+ Bug 2（詳情面板日期變更同步月曆視圖）

---

## Step 1 — Bug 1：開始日期 onChange 自動順移結束日期

**檔案**：`src/components/TaskDetailPanel.tsx`

**變更**：
找到「開始日期」的 `input[type=date]`，其 `onChange` 目前為：
```tsx
onChange={(e) => setStartDate(e.target.value)}
```

改為：
```tsx
onChange={(e) => {
  const newStart = e.target.value;
  setStartDate(newStart);
  // Bug 1 fix：若新開始日 > 既有結束日，自動將結束日順移至開始日
  if (dueDate && newStart > dueDate) {
    setDueDate(newStart);
  }
}}
```

**驗證**：
1. `npx tsc --noEmit` → 0 errors
2. 手動操作：任務已有結束日期（如 2026-09-28），將開始日期改為 2026-10-01，觀察結束日期是否自動變為 2026-10-01

---

## Step 2 — 建立 `useSelectedTask` Hook

**檔案**：`src/hooks/useSelectedTask.ts`（新建立）

**內容**：
```ts
import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { Task } from "@/lib/types";
import type { SharedListData } from "@/lib/storage";

function findTaskById(
  id: string | null,
  tasks: Task[],
  sharedLists: Record<string, SharedListData>
): Task | null {
  if (!id) return null;
  const local = tasks.find((t) => t.id === id);
  if (local) return local;
  for (const listData of Object.values(sharedLists)) {
    const found = listData.tasks.find((t) => t.id === id);
    if (found) return found;
  }
  return null;
}

export function useSelectedTask(): Task | null {
  const selectedTaskId = useApp((s) => s.selectedTaskId ?? null);
  const tasks = useApp((s) => s.tasks);
  const sharedLists = useApp((s) => s.sharedLists ?? {});

  return useMemo(
    () => findTaskById(selectedTaskId, tasks, sharedLists),
    [selectedTaskId, tasks, sharedLists]
  );
}
```

**驗證**：
1. `npx tsc --noEmit` → 0 errors
2. 確認 `src/hooks/useSelectedTask.ts` 已建立且無語法錯誤

---

## Step 3 — AppContext 加入 selectedTaskId state + action

**檔案**：`src/lib/AppContext.tsx`

**變更**：
1. 在 `AppContextValue` interface 加入：
```ts
selectedTaskId: string | null;
selectTask: (id: string | null) => void;
```

2. 在 `AppProvider` 的 `useState` 區段確認是否有 `selectedTaskId`（可能在 AppLayout 已存在）；若無，加入：
```ts
const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
```

3. 在 `value` object 加入：
```ts
selectedTaskId,
selectTask: setSelectedTaskId,
```

**注意**：若 `selectedTaskId` 已在 `AppLayout.tsx` 改為 `useState` 局部 state，此步驟改為「確認 AppContext 確實**不**需要這層 state」（以免重複）。

**驗證**：`npx tsc --noEmit` → 0 errors

---

## Step 4 — AppLayout 移除 snapshot state，改用 ID

**檔案**：`src/components/AppLayout.tsx`

**變更**：

1. 移除（或註解掉）`calendarSelectedTask` state：
```ts
// 移除這行：
// const [calendarSelectedTask, setCalendarSelectedTask] = useState<Task | null>(null);

// 改為只保留 ID：
const [calendarSelectedTaskId, setCalendarSelectedTaskId] = useState<string | null>(null);
```

2. 移除 `calendarTask` derived value：
```ts
// 移除這段：
// const calendarTask = currentView === 'calendar' ? calendarSelectedTask : null;
// const detailTask = calendarTask || selectedTask;

// 改為直接用 selectedTaskId 組合：
const detailTaskId = calendarSelectedTaskId ?? selectedTaskId;
```

3. 改 `CalendarView` 傳參：
```ts
// 從：
selectedTask={calendarSelectedTask}
onSelectTask={(task) => { setCalendarSelectedTask(task); }}

// 改為：
selectedTaskId={calendarSelectedTaskId}
onSelectTaskId={(id) => { setCalendarSelectedTaskId(id); }}
```

4. 改 `renderDetailPanel` 的 `onClose`：
```ts
// 從：
onClose={() => { setSelectedTaskId(null); setCalendarSelectedTask(null); }}

// 改為：
onClose={() => { setSelectedTaskId(null); setCalendarSelectedTaskId(null); }}
```

5. 移除 `selectedTask` derived value 中對 `calendarTask` 的依賴（只剩從 tasks 查）：
```ts
// 確認 detailTask 改為用 findTaskById 或直接：
const detailTask = useSelectedTask(); // 使用 Step 2 的 hook
```

**驗證**：
1. `npx tsc --noEmit` → 0 errors
2. 若有類型錯誤，可能是 `selectedTaskId` state 位置衝突，需對照 Step 3 結果

---

## Step 5 — CalendarView 改用 selectedTaskId

**檔案**：`src/components/CalendarView.tsx`

**變更**：

1. 修改 props interface（找到 `CalendarViewProps`）：
```ts
// 從：
selectedTask: Task | null;
onSelectTask: (task: Task) => void;

// 改為：
selectedTaskId: string | null;
onSelectTaskId: (id: string) => void;
```

2. 內部 derived value：
```ts
// 從：
const selectedTask = selectedTask;

// 改為（在 Desktop/Mobile layout helpers 裡）：
const selectedTask = useMemo(
  () => tasks.find((t) => t.id === selectedTaskId) ?? null,
  [selectedTaskId, tasks]
);
```

3. 將所有 `onSelectTask(task)` 呼叫改為 `onSelectTaskId(task.id)`

4. 將 `selectedTask={...}` prop 傳遞改為對應新名稱（`selectedTaskId={...}`）

**驗證**：`npx tsc --noEmit` → 0 errors

---

## Step 6 — TaskDetailPanel 改用 taskId prop + hook

**檔案**：`src/components/TaskDetailPanel.tsx`

**變更**：

1. 修改介面：
```ts
// 從：
interface TaskDetailPanelProps {
  task: Task;
  onClose?: () => void;
}

// 改為：
interface TaskDetailPanelProps {
  taskId: string;   // 直接傳 ID，由 hook 拉最新
  onClose?: () => void;
}
```

2. 內部：
```ts
// 從：
// const { updateTask, ... } = useApp();
// const task = /* 從 prop */;

const task = useSelectedTask();

// 更新所有 useApp() 中對 task prop 的引用 → 改為用 task（hook 回傳）
// 注意：handleUpdateTask 的 routing 仍用 task.id，不受影響
```

3. 移除所有從 prop 直接取 `task.xxx` 的地方（改用 `task` 變數）

4. 元件 JSX：
```tsx
// 從：
<TaskDetailPanel task={detailTask} onClose={...} />

// 改為：
<TaskDetailPanel taskId={detailTaskId ?? ""} onClose={...} />
```

**注意**：若 `taskId` 為空字串（detailTaskId 為 null），需加防護：
```ts
if (!taskId) return null; // 面板不渲染
const task = useSelectedTask();
if (!task) return null; // 任務已刪除
```

**驗證**：`npx tsc --noEmit` → 0 errors

---

## Step 7 — 最終整合驗證

**操作**：
1. 啟動 dev server：`npm run dev`
2. 開瀏覽器至月曆視圖
3. 建立一個有開始日 + 結束日的任務
4. 點任務卡片開啟詳情面板
5. **Bug 1 驗證**：將開始日期往後調，確認結束日期自動順移
6. **Bug 2 驗證**：在詳情面板改任務日期，關閉面板，回到月曆，確認月曆網格上該任務的日期已更新
7. 測試：從月曆視圖外（inbox）點開同一任務，詳情面板關閉後，月曆視圖內點同一任務，確認拿到的仍是 fresh 資料

**驗收標準**：
- 月曆上每個任務的日期 = localStorage 裡最新值
- 詳情面板內的 task 永遠是 store 裡的即時快照（無需重開面板）
- `npx tsc --noEmit` → 0 errors
- `npm run build` → success

---

## 依賴順序

```
Step 1（Bug 1）──────────→ 獨立，可最先執行
Step 2 ─────────────────→ Step 6 依賴
Step 3 ─────────────────→ Step 4 依賴
Step 4 ─────────────────→ Step 5、Step 6 依賴
Step 5 ─────────────────→ Step 4 完成後執行
Step 6 ─────────────────→ Step 2、Step 4 完成後執行
Step 7 ─────────────────→ 所有步驟完成後執行
```

**嚴禁跳步**：Step 3 必須在 Step 4 之前完成（類型定義需先就緒），Step 2 必須在 Step 6 之前完成（hook 需存在）。
