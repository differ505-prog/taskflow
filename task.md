# Provider 重構 — 實作清單（Low-Level Step-by-Step）

> 本清單將 `provider.tsx`（1998 行）縱向拆分為多個職責清晰的獨立 Provider。
> **禁止跳步。** 依賴順序即編號順序。完成每步後跑 `npx tsc --noEmit` 確認編譯乾淨。

---

## Step 1 — 建立 `src/lib/constants.ts`（constants extraction）

### 目標檔案
新建 `src/lib/constants.ts`

### 變更內容

```typescript
// src/lib/constants.ts

// --- Time Windows (ms) ---
export const RECENT_WRITE_WINDOW_MS = 5_000;
export const EDIT_ACTIVITY_WINDOW_MS = 30_000;
export const RECENT_DELETE_WINDOW_MS = 10_000;
export const UNDO_WINDOW_MS = 5_000;
export const ACTIVE_THROTTLE_MS = 30_000;

// --- App Views ---
export type AppView =
  | "inbox"
  | "today"
  | "upcoming"
  | "calendar"
  | "habits"
  | "tags"
  | "settings"
  | "zen"
  | "shared-list"
  | "shared-inbox"
  | "admin";

// --- View Labels (used in Header) ---
export const VIEW_LABELS: Record<AppView, string> = {
  inbox: "收集箱",
  today: "今天",
  upcoming: "即將到來",
  calendar: "日曆",
  habits: "習慣",
  tags: "標籤",
  settings: "設定",
  zen: "禪",
  "shared-list": "共享清單",
  "shared-inbox": "共享收集箱",
  admin: "管理",
};
```

### 驗證方式
```bash
npx tsc --noEmit
```
預期：無 error，無 output。

---

## Step 2 — 抽出 `src/hooks/useWriteGuard.ts`

### 目標檔案
新建 `src/hooks/useWriteGuard.ts`

### 變更內容
從 `provider.tsx` 行 118–175 抽出 5 種 Map/Set ref 為獨立 hook：

```typescript
// src/hooks/useWriteGuard.ts
import { useRef, useCallback } from "react";
import { RECENT_WRITE_WINDOW_MS, EDIT_ACTIVITY_WINDOW_MS, RECENT_DELETE_WINDOW_MS } from "@/lib/constants";

export function useWriteGuard() {
  const recentlyWrittenRef = useRef<Map<string, number>>(new Map());
  const editingTaskIdsRef = useRef<Set<string>>(new Set());
  const lastEditActivityRef = useRef<Map<string, number>>(new Map());
  const recentlyWrittenHabitsRef = useRef<Map<string, number>>(new Map());
  const recentlyWrittenListsRef = useRef<Map<string, number>>(new Map());

  const markRecentlyWritten = useCallback((id: string) => {
    recentlyWrittenRef.current.set(id, Date.now());
    setTimeout(() => recentlyWrittenRef.current.delete(id), RECENT_WRITE_WINDOW_MS);
  }, []);

  const isWithinRecentWriteWindow = useCallback((id: string): boolean => {
    const ts = recentlyWrittenRef.current.get(id);
    return ts !== undefined && Date.now() - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  // ... 其餘 3 種 guard methods（markEditingActivity, clearEditingActivity, isWithinEditingActivityWindow, isListWithinRecentWriteWindow）
  // 直接從 provider.tsx 行 138–175 複製邏輯，僅替換 ms 常數為 import

  return {
    recentlyWrittenRef,
    editingTaskIdsRef,
    recentlyWrittenHabitsRef,
    recentlyWrittenListsRef,
    markRecentlyWritten,
    isWithinRecentWriteWindow,
    // ... 其餘 return 值
  };
}
```

### 驗證方式
```bash
npx tsc --noEmit
grep -n "RECENT_WRITE_WINDOW_MS" src/lib/AppContextInternal/provider.tsx
```
預期：grep 只找到 import 語句，無內聯數字。

---

## Step 3 — 抽出 `src/lib/AppContextInternal/AppRouterProvider.tsx`

### 目標檔案
新建 `src/lib/AppContextInternal/AppRouterProvider.tsx`

### 變更內容
從 `provider.tsx` 行 108–115、581–595 抽出 view/listId/sharedId state：

```typescript
// src/lib/AppContextInternal/AppRouterProvider.tsx
import { createContext, useContext, useState, useCallback } from "react";
import { AppView } from "@/lib/constants";

interface AppRouterContextValue {
  currentView: AppView;
  setCurrentView: (v: AppView, listId?: string) => void;
  currentListId: string | undefined;
  setCurrentListId: (id: string | undefined) => void;
  currentSharedListId: string | undefined;
  setCurrentSharedList: (id: string | undefined) => void;
}

const AppRouterContext = createContext<AppRouterContextValue | null>(null);

export function AppRouterProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentViewState] = useState<AppView>("inbox");
  const [currentListId, setCurrentListId] = useState<string | undefined>(undefined);
  const [currentSharedListId, setCurrentSharedListIdState] = useState<string | undefined>(undefined);

  const setCurrentView = useCallback((v: AppView, listId?: string) => {
    setCurrentViewState(v);
    if (listId !== undefined) setCurrentListId(listId);
  }, []);

  const setCurrentSharedList = useCallback((sharedId: string | undefined) => {
    setCurrentSharedListIdState(sharedId);
  }, []);

  return (
    <AppRouterContext.Provider value={{
      currentView, setCurrentView,
      currentListId, setCurrentListId,
      currentSharedListId, setCurrentSharedList,
    }}>
      {children}
    </AppRouterContext.Provider>
  );
}

export function useAppRouter() {
  const ctx = useContext(AppRouterContext);
  if (!ctx) throw new Error("useAppRouter must be inside AppRouterProvider");
  return ctx;
}
```

### 驗證方式
```bash
npx tsc --noEmit
grep -n "setCurrentView\|currentView\|currentListId\|currentSharedListId" src/lib/AppContextInternal/provider.tsx | head -5
```
預期：provider.tsx 內只剩 import 和 delegate call。

---

## Step 4 — 抽出 `src/lib/AppContextInternal/TasksProvider.tsx`

### 目標檔案
新建 `src/lib/AppContextInternal/TasksProvider.tsx`

### 變更內容
從 `provider.tsx` 行 98–99（tasks state）、788–1300 附近（all task methods）抽出：

- state: `tasks`, `setTasks`（行 98–99）
- `addTask`, `addTaskLocalOnly`, `batchAddTasks`（行 788–857）
- `moveTaskToShared`（行 859–930）
- `updateTask`（行 931–999）
- `undoDelete`, `deleteTask`（行 1002–1073）
- `toggleTaskStatus`, `toggleTaskStatusRef`, `completeTask`（行 1074–1215）
- `addSubTask`, `toggleSubTask`, `deleteSubTask`, `reorderSubTasks`（行 1135–1170）
- `completeRecurringAndClone`（行 1173–1197）
- `archiveTask`, `unarchiveTask`, `escapeTask`（行 1109–1133）
- `getFilteredTasks`, `getListTaskCount`, `getTagCounts`（行 597–727）
- `saveTasksDirectly`（行 1296–1306）

Context interface:
```typescript
interface TasksContextValue {
  tasks: Task[];
  getFilteredTasks: () => Task[];
  getListTaskCount: (listId: string) => number;
  getTagCounts: () => Record<string, number>;
  addTask: (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => void;
  // ... 其餘 methods
}
```

### 驗證方式
```bash
npx tsc --noEmit
```
預期：0 error。TasksProvider 內可見 `useWriteGuard()` 回傳值做參數傳入。

---

## Step 5 — 抽出 `src/lib/AppContextInternal/ListsProvider.tsx`

### 目標檔案
新建 `src/lib/AppContextInternal/ListsProvider.tsx`

### 變更內容
從 `provider.tsx` 抽出：

- state: `lists`, `setLists`（行 100–101）
- `addList`, `updateList`, `deleteList`（行 1217–1255）
- `markListRecentlyWritten`, `isListWithinRecentWriteWindow`（行 1257–1267）
- `reorderLists`（行 1270–1282）
- `dedupeDuplicateLists`, `rebindTasksToKeptLists`（行 729–785）

Context interface:
```typescript
interface ListsContextValue {
  lists: TaskList[];
  addList: (data: Omit<TaskList, "id" | "createdAt" | "updatedAt" | "order">) => string;
  updateList: (id: string, updates: Partial<TaskList>) => void;
  deleteList: (id: string) => void;
  reorderLists: (newListOrder: TaskList[]) => void;
}
```

### 驗證方式
```bash
npx tsc --noEmit
grep -n "setLists\|useCallback\|addList\|updateList\|deleteList" src/lib/AppContextInternal/provider.tsx | wc -l
```
預期：只剩 delegate call（`useLists()` → 內部呼叫）。

---

## Step 6 — 抽出 `src/lib/AppContextInternal/HabitsProvider.tsx`

### 目標檔案
新建 `src/lib/AppContextInternal/HabitsProvider.tsx`

### 變更內容
從 `provider.tsx` 抽出：

- state: `habits`, `setHabits`（行 100–101）
- `addHabit`, `updateHabit`, `archiveHabit`, `unarchiveHabit`（行 1309–1357）
- `syncWriteHabitRef`, `recentlyWrittenHabitsRef`（行 132–133 從 useWriteGuard 取用）

Context interface:
```typescript
interface HabitsContextValue {
  habits: Habit[];
  addHabit: (data: Omit<Habit, "id" | "createdAt" | "updatedAt" | "checkins" | "streak" | "longestStreak">) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  archiveHabit: (id: string) => void;
  unarchiveHabit: (id: string) => void;
}
```

### 驗證方式
```bash
npx tsc --noEmit
```

---

## Step 7 — 抽出 `src/lib/AppContextInternal/SharedListsProvider.tsx`

### 目標檔案
新建 `src/lib/AppContextInternal/SharedListsProvider.tsx`

### 變更內容
從 `provider.tsx` 行 192–240（sharedLists/ownedSharedListIds/members/myRole state）抽出：

- state: `sharedLists`, `ownedSharedListIds`, `acceptedSharedListIds`, `myRoleByList`, `membersBySharedList`
- refs: `sharedListUnsubscribeRefs`, `remoteSharedTasksRef`, `lastSyncedHashRef`, `snapshotReadyRef`, `snapshotTasksRef`, `isWritingRef`
- methods: `setOwnedSharedListIds`, `setMyRoleByList`, 所有 Firestore subscription 相關 logic

Context interface:
```typescript
interface SharedListsContextValue {
  sharedLists: Record<string, SharedListData>;
  ownedSharedListIds: string[];
  acceptedSharedListIds: string[];
  myRoleByList: Record<string, MemberRole>;
  membersBySharedList: Record<string, SharedMember[]>;
  setOwnedSharedListIds: (updater: string[] | ((prev: string[]) => string[])) => void;
  setMyRoleByList: (updater: Record<string, MemberRole> | ((prev: Record<string, MemberRole>) => Record<string, MemberRole>)) => void;
}
```

### 驗證方式
```bash
npx tsc --noEmit
```

---

## Step 8 — 重構 `AppProvider` 為純組合層

### 目標檔案
`src/lib/AppContextInternal/provider.tsx`（大幅精簡後）

### 變更內容

最終 `provider.tsx` 應只剩：

```typescript
// src/lib/AppContextInternal/provider.tsx

import { AppRouterProvider } from "./AppRouterProvider";
import { TasksProvider } from "./TasksProvider";
import { ListsProvider } from "./ListsProvider";
import { HabitsProvider } from "./HabitsProvider";
import { SharedListsProvider } from "./SharedListsProvider";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterProvider>
      <ListsProvider>
        <TasksProvider>
          <HabitsProvider>
            <SharedListsProvider>
              {children}
            </SharedListsProvider>
          </HabitsProvider>
        </TasksProvider>
      </ListsProvider>
    </AppRouterProvider>
  );
}

// useApp = compose all contexts
export function useApp() {
  const router = useAppRouter();
  const lists = useLists();
  const tasks = useTasks();
  const habits = useHabits();
  const shared = useSharedLists();
  return { ...router, ...lists, ...habits, ...shared, tasks: tasks.tasks, /* ... spread all contexts */ };
}
```

目標行數：`< 200 行`。

### 驗證方式

```bash
npx tsc --noEmit
wc -l src/lib/AppContextInternal/provider.tsx
```
預期：行數 ≤ 200，tsc 0 error。

```bash
npm run dev &
# 手動：登入 → 開收集箱 → 新增任務 → 刪除 → 撤銷 → 刷新 → 任務還在
```

---

## Step 9 — `useApp()` 簽名保持向後相容（破壞性變更檢查）

### 目標檔案
`src/lib/AppContextInternal/provider.tsx`（useApp export）

### 變更內容
確保 `useApp()` 回傳的**每一個欄位名稱**與重構前完全相同：
- 所有既有的 `useApp()` 呼叫（共 56 處）**不需要修改**才算成功
- 若有新欄位差異，在 `useApp()` 內補 `{ legacyKey: newValue }` 映射

驗證 script（在 `src/` 執行）：
```bash
grep -rn "const {" src --include="*.tsx" | grep "useApp()" | head -10
```
確認每個呼叫點的 destructuring key 仍在新 `useApp()` 回傳值中。

### 驗證方式

```bash
# 靜態：確保 tsc clean
npx tsc --noEmit

# 動態：
npm run build 2>&1 | tail -5
```
預期：`Build: success` + 0 error。

---

## Step 10（可選）— `localStorage` 集中到 typed wrapper

### 目標檔案
新建 `src/lib/storageService.ts`，修改 `src/lib/storage.ts`

### 變更內容

在 `storage.ts`（579 行）基礎上加 typed wrapper：

```typescript
// src/lib/storageService.ts
import { storage } from "./storage"; // 現有的

export const storageService = {
  getTheme: () => storage.getString("theme") as "light" | "dark" | "system" | undefined,
  setTheme: (v: "light" | "dark" | "system") => storage.set("theme", v),
  getOnboardingStep: () => storage.getNumber("onboarding_step"),
  // ... 其餘 28 個 key，全部集中在這裡
} as const;

// 在各元件中：
// 改前：import { useApp } from "@/lib/AppContext"; const theme = localStorage.getItem("theme");
// 改後：import { storageService } from "@/lib/storageService"; const theme = storageService.getTheme();
```

分批遷移（每個 key 為一個 commit），**每個 commit 完成後** `npx tsc --noEmit`。

### 驗證方式
```bash
grep -rn "localStorage\." src --include="*.tsx" --include="*.ts" | grep -v storageService | wc -l
```
目標：逐年降至 0。

---

## 依賴圖（Dependency Order）

```
Step 1 (constants)  ─┐
                     ├─► Step 2 (useWriteGuard) ─┐
Step 3 (AppRouter)  ─┤                          ├─► Step 4 (TasksProvider) ─┐
                     │                          │                           │
Step 5 (ListsProvider) ──► Step 6 (Habits) ──┘                           │
                                                                             │
Step 7 (SharedListsProvider) ──────────────────────────────────────────────► Step 8 (AppProvider composition)
                                                                             │
Step 9 (useApp 向後相容驗證) ◄──────────────────────────────────────────────┘
                                                                             │
Step 10 (localStorage typed wrapper — 可並行，在 Step 8 後隨時開始)
```

**禁止跳步的意義**：Step 4–7 依賴 Step 2 的 `useWriteGuard` 回傳值；Step 8 依賴 Step 3–7 全部完成。跳步將導致 cyclic import 或型別斷裂。
