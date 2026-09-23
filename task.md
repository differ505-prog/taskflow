# Provider 重構 — Low-Level 實作清單

> 目標：將 `src/lib/AppContextInternal/provider.tsx`（1,960 行）拆解為 6 個職責清晰的独立 Store。
> **禁止跳步。** 依賴順序即編號順序。完成每步後立即執行驗證指令。

---

## Step 1 — 建立常數收斂層

### 新建
- `src/lib/constants.ts`

### 變更內容

```typescript
// src/lib/constants.ts

// ── Time Windows (ms) ────────────────────────────────
export const RECENT_WRITE_WINDOW_MS = 5_000;
export const EDIT_ACTIVITY_WINDOW_MS = 30_000;
export const RECENT_DELETE_WINDOW_MS = 10_000;
export const UNDO_WINDOW_MS = 5_000;
export const ACTIVE_THROTTLE_MS = 30_000;

// ── App Views ───────────────────────────────────────
export type AppView =
  | "inbox" | "today" | "next7days" | "all" | "calendar"
  | "habits" | "tags" | "list" | "stats" | "shared"
  | "archived" | "pinned" | "quadrant" | "command-center";
```

### 驗證
```bash
npx tsc --noEmit
```
預期：無 error。

### 依賴
無。

---

## Step 2 — 抽出 Write Guard Hook

### 新建
- `src/hooks/useWriteGuard.ts`

### 變更內容

從 `provider.tsx` 行 118–175 抽出以下 refs 和 methods：

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

  const markEditingActivity = useCallback((id: string) => {
    lastEditActivityRef.current.set(id, Date.now());
  }, []);

  const clearEditingActivity = useCallback((id: string) => {
    lastEditActivityRef.current.delete(id);
  }, []);

  const isWithinEditingActivityWindow = useCallback((id: string): boolean => {
    const ts = lastEditActivityRef.current.get(id);
    return ts !== undefined && Date.now() - ts < EDIT_ACTIVITY_WINDOW_MS;
  }, []);

  const markRecentlyWrittenHabits = useCallback((id: string) => {
    recentlyWrittenHabitsRef.current.set(id, Date.now());
    setTimeout(() => recentlyWrittenHabitsRef.current.delete(id), RECENT_WRITE_WINDOW_MS);
  }, []);

  const isWithinRecentWriteWindowHabits = useCallback((id: string): boolean => {
    const ts = recentlyWrittenHabitsRef.current.get(id);
    return ts !== undefined && Date.now() - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  const markRecentlyWrittenLists = useCallback((id: string) => {
    recentlyWrittenListsRef.current.set(id, Date.now());
    setTimeout(() => recentlyWrittenListsRef.current.delete(id), RECENT_WRITE_WINDOW_MS);
  }, []);

  const isListWithinRecentWriteWindow = useCallback((id: string): boolean => {
    const ts = recentlyWrittenListsRef.current.get(id);
    return ts !== undefined && Date.now() - ts < RECENT_WRITE_WINDOW_MS;
  }, []);

  return {
    recentlyWrittenRef,
    editingTaskIdsRef,
    lastEditActivityRef,
    recentlyWrittenHabitsRef,
    recentlyWrittenListsRef,
    markRecentlyWritten,
    isWithinRecentWriteWindow,
    markEditingActivity,
    clearEditingActivity,
    isWithinEditingActivityWindow,
    markRecentlyWrittenHabits,
    isWithinRecentWriteWindowHabits,
    markRecentlyWrittenLists,
    isListWithinRecentWriteWindow,
  };
}
```

### 驗證
```bash
npx tsc --noEmit
grep -n "RECENT_WRITE_WINDOW_MS\|EDIT_ACTIVITY_WINDOW_MS\|RECENT_DELETE_WINDOW_MS" src/lib/AppContextInternal/provider.tsx
```
預期：tsc 0 error；grep 只找到 import 語句，無內聯數字。

### 依賴
Step 1。

---

## Step 3 — 抽出 AppRouterProvider

### 新建
- `src/lib/AppContextInternal/AppRouterProvider.tsx`

### 變更內容

從 `provider.tsx` 行 108–115、581–595 抽出 view/listId/sharedId state：

```typescript
// src/lib/AppContextInternal/AppRouterProvider.tsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { AppView } from "@/lib/constants";

interface AppRouterContextValue {
  currentView: AppView;
  setCurrentView: (v: AppView, listId?: string) => void;
  currentListId: string | undefined;
  setCurrentListId: (id: string | undefined) => void;
  currentSharedListId: string | undefined;
  setCurrentSharedList: (sharedId: string | undefined) => void;
}

const AppRouterContext = createContext<AppRouterContextValue | null>(null);

export function AppRouterProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentViewState] = useState<AppView>("inbox");
  const [currentListId, setCurrentListId] = useState<string | undefined>(undefined);
  const [currentSharedListId, setCurrentSharedListIdState] = useState<string | undefined>(undefined);

  const setCurrentView = useCallback((v: AppView, listId?: string) => {
    setCurrentViewState(v);
    if (listId !== undefined) setCurrentListId(listId);
    setCurrentSharedListIdState(undefined);
  }, []);

  const setCurrentSharedList = useCallback((sharedId: string | undefined) => {
    setCurrentSharedListIdState(sharedId);
    if (sharedId) setCurrentViewState("shared");
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

### 驗證
```bash
npx tsc --noEmit
grep -n "setCurrentViewState\|currentView.*=.*useState" src/lib/AppContextInternal/provider.tsx
```
預期：tsc 0 error；grep 在 provider.tsx 中無輸出（已全部移出）。

### 依賴
Step 1。

---

## Step 4 — 抽出 TasksProvider

### 新建
- `src/lib/AppContextInternal/TasksProvider.tsx`

### 從 provider.tsx 移出
- 行 100 行：`tasks`, `setTasks` state
- 行 597–727：`getFilteredTasks`, `getListTaskCount`, `getTagCounts`, `viewCounts`
- 行 788–857：`addTask`, `addTaskLocalOnly`, `batchAddTasks`
- 行 859–930：`moveTaskToShared`
- 行 931–999：`updateTask`
- 行 1002–1073：`undoDelete`, `deleteTask`
- 行 1074–1215：`toggleTaskStatus`, `toggleTaskStatusRef`, `completeTask`
- 行 1109–1133：`archiveTask`, `unarchiveTask`, `escapeTask`
- 行 1135–1170：`addSubTask`, `toggleSubTask`, `deleteSubTask`, `reorderSubTasks`
- 行 1173–1197：`completeRecurringAndClone`
- 行 1296–1306：`saveTasksDirectly`

### 變更內容

```typescript
// src/lib/AppContextInternal/TasksProvider.tsx
"use client";
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { Task, TaskList, PRIORITY_RANK, migratePriority, SharedListData } from "@/lib/types";
import { saveTasks, getTasks } from "@/lib/storage";
import { generateId } from "@/lib/storage";
import { useWriteGuard } from "@/hooks/useWriteGuard";

interface TasksContextValue {
  tasks: Task[];
  getFilteredTasks: (opts: FilterOpts) => Task[];
  getListTaskCount: (listId: string) => number;
  getTagCounts: () => Record<string, number>;
  viewCounts: ReturnType<typeof computeViewCounts>;
  addTask: (data: NewTaskInput) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => void;
  completeTask: (id: string) => void;
  addSubTask: (taskId: string, title: string) => void;
  toggleSubTask: (taskId: string, subTaskId: string) => void;
  deleteSubTask: (taskId: string, subTaskId: string) => void;
  reorderSubTasks: (taskId: string, oldIndex: number, newIndex: number) => void;
  completeRecurringAndClone: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  reorderTasks: (activeId: string, overId: string) => void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

interface FilterOpts {
  currentView: string;
  currentListId?: string;
  searchQuery?: string;
  activeFilter?: { priority?: string; status?: string; tag?: string };
  sharedLists?: Record<string, SharedListData>;
  lists?: TaskList[];
}

export function computeViewCounts(tasks: Task[]) {
  const active = tasks.filter((t) => !t.isArchived);
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const weekEndDate = new Date(now.getTime() + 7 * 86400000);
  const localWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth()+1).padStart(2,"0")}-${String(weekEndDate.getDate()).padStart(2,"0")}`;
  return {
    inbox: active.filter((t) => !t.listId && t.status !== "done").length,
    today: active.filter((t) => {
      if (!t.dueDate || t.status === "done") return false;
      return t.dueDate === localToday || t.dueDate < localToday;
    }).length,
    next7days: active.filter((t) => t.dueDate && t.dueDate >= localToday && t.dueDate <= localWeekEnd && t.status !== "done").length,
  };
}

export { FilterOpts };
```

**內部實作**：直接移植 provider.tsx 中對應函式的完整邏輯，將 `setTasks` 替換為內部 state setter，將 `isWithinRecentWriteWindow(id)` 改為呼叫 `writeGuard.isWithinRecentWriteWindow(id)`。

### 驗證
```bash
npx tsc --noEmit
```
預期：0 error。

### 依賴
Step 2（`useWriteGuard`）。

---

## Step 5 — 抽出 ListsProvider

### 新建
- `src/lib/AppContextInternal/ListsProvider.tsx`

### 從 provider.tsx 移出
- 行 100–101：`lists`, `setLists` state
- 行 729–785：`dedupeDuplicateLists`, `rebindTasksToKeptLists`
- 行 1217–1255：`addList`, `updateList`, `deleteList`
- 行 1257–1267：`markListRecentlyWritten`, `isListWithinRecentWriteWindow`
- 行 1270–1282：`reorderLists`

### 變更內容

```typescript
// src/lib/AppContextInternal/ListsProvider.tsx
"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import { TaskList, Task, DEFAULT_LIST_IDS } from "@/lib/types";
import { saveLists, getLists, generateId } from "@/lib/storage";
import { useWriteGuard } from "@/hooks/useWriteGuard";

interface ListsContextValue {
  lists: TaskList[];
  addList: (data: NewListInput) => string;
  updateList: (id: string, updates: Partial<TaskList>) => void;
  deleteList: (id: string) => void;
  reorderLists: (newListOrder: TaskList[]) => void;
}

const ListsContext = createContext<ListsContextValue | null>(null);
```

**內部實作**：直接移植對應函式。`markListRecentlyWritten` 改為呼叫 `writeGuard.markRecentlyWrittenLists(id)`，`isListWithinRecentWriteWindow` 改為呼叫 `writeGuard.isListWithinRecentWriteWindow(id)`。

### 驗證
```bash
npx tsc --noEmit
grep -n "setLists\|useCallback.*addList\|useCallback.*updateList\|useCallback.*deleteList" src/lib/AppContextInternal/provider.tsx | wc -l
```
預期：tsc 0 error；grep 輸出 0（只剩 delegate call）。

### 依賴
Step 2。

---

## Step 6 — 抽出 HabitsProvider

### 新建
- `src/lib/AppContextInternal/HabitsProvider.tsx`

### 從 provider.tsx 移出
- 行 103：`habits`, `setHabits` state
- 行 1309–1357：`addHabit`, `updateHabit`, `archiveHabit`, `unarchiveHabit`
- 行 138–139：從 `useWriteGuard` 取用 `recentlyWrittenHabitsRef`, `markRecentlyWrittenHabits`, `isWithinRecentWriteWindowHabits`

### 變更內容

```typescript
// src/lib/AppContextInternal/HabitsProvider.tsx
"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import { Habit, generateId } from "@/lib/types";
import { saveHabits } from "@/lib/storage";
import { useWriteGuard } from "@/hooks/useWriteGuard";

interface HabitsContextValue {
  habits: Habit[];
  addHabit: (data: NewHabitInput) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  archiveHabit: (id: string) => void;
  unarchiveHabit: (id: string) => void;
}

const HabitsContext = createContext<HabitsContextValue | null>(null);
```

**內部實作**：直接移植對應函式。

### 驗證
```bash
npx tsc --noEmit
```

### 依賴
Step 2。

---

## Step 7 — 抽出 SharedListsProvider

### 新建
- `src/lib/AppContextInternal/SharedListsProvider.tsx`

### 從 provider.tsx 移出
- 行 192–240：`sharedLists`, `ownedSharedListIds`, `acceptedSharedListIds`, `myRoleByList`, `membersBySharedList` state
- 行 142–188：所有 refs（`sharedListUnsubscribeRefs`, `remoteSharedTasksRef`, `lastSyncedHashRef`, `snapshotReadyRef`, `snapshotTasksRef`, `isWritingRef`）
- 行 1379–1500：兩個 Firestore subscription useEffect（owned + accepted）
- 行 1501–1525：拉回身份 useEffect
- 行 1530–1610：`canEditSharedList`, `guardWrite`, `quickAddToShared`, `updateSharedTask`, `deleteSharedTask`, `ensureSharedListData`
- 行 125–136：`discoverNewSharedLists`, `removeSharedList`, `deduplicateSharedLists`

### 變更內容

```typescript
// src/lib/AppContextInternal/SharedListsProvider.tsx
"use client";
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { SharedListData, SharedMember, MemberRole } from "@/lib/types";
import { subscribeToSharedSnapshot } from "@/lib/firestore";
import { saveSharedList, getSharedLists, removeSharedList } from "@/lib/storage";
import { getMyRoleInSharedList } from "@/lib/firestore";

interface SharedListsContextValue {
  sharedLists: Record<string, SharedListData>;
  ownedSharedListIds: string[];
  acceptedSharedListIds: string[];
  myRoleByList: Record<string, MemberRole>;
  membersBySharedList: Record<string, SharedMember[]>;
  setOwnedSharedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  setMyRoleByList: React.Dispatch<React.SetStateAction<Record<string, MemberRole>>>;
  canEditSharedList: (sharedListId: string) => boolean;
  quickAddToShared: (sharedListId: string, input: string, userUid?: string) => string | null;
  updateSharedTask: (sharedListId: string, taskId: string, updates: Partial<import("@/lib/types").Task>) => void;
  deleteSharedTask: (sharedListId: string, taskId: string) => void;
  ensureSharedListData: (sharedListId: string) => Promise<SharedListData | null>;
}

const SharedListsContext = createContext<SharedListsContextValue | null>(null);
```

**內部實作**：直接移植所有移出的函式和 useEffect。

### 驗證
```bash
npx tsc --noEmit
```

### 依賴
Step 2。

---

## Step 8 — 重構 AppProvider 為純組合層

### 修改
- `src/lib/AppContextInternal/provider.tsx`

### 變更內容

精簡後的 `provider.tsx`（目標 ≤ 200 行）：

```typescript
// src/lib/AppContextInternal/provider.tsx
"use client";
import React from "react";
import { AppRouterProvider } from "./AppRouterProvider";
import { TasksProvider } from "./TasksProvider";
import { ListsProvider } from "./ListsProvider";
import { HabitsProvider } from "./HabitsProvider";
import { SharedListsProvider } from "./SharedListsProvider";
import { useAuth } from "@/lib/AuthContext";
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { AppShellSkeleton } from "@/components/Skeleton";

// ── 組合層 ──────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const writeGuard = useWriteGuard();
  return (
    <AppRouterProvider>
      <ListsProvider writeGuard={writeGuard}>
        <TasksProvider writeGuard={writeGuard}>
          <HabitsProvider writeGuard={writeGuard}>
            <SharedListsProvider writeGuard={writeGuard}>
              <AppBootLoader>{children}</AppBootLoader>
            </SharedListsProvider>
          </HabitsProvider>
        </TasksProvider>
      </ListsProvider>
    </AppRouterProvider>
  );
}

function AppBootLoader({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Boot: subscribeTasks, subscribeLists, subscribeHabits, discoverNewSharedLists
  // 從原 provider.tsx 行 285–505 移植
  return <>{children}</>;
}

// ── useApp = 組合所有 context ────────────────────
export { useAppRouter } from "./AppRouterProvider";

export function useApp() {
  const router = useAppRouter();
  // 從 TasksProvider, ListsProvider, HabitsProvider, SharedListsProvider
  // 組合回統一的 API surface，保持與重構前完全相同
}
```

### 驗證
```bash
npx tsc --noEmit
wc -l src/lib/AppContextInternal/provider.tsx
```
預期：tsc 0 error；行數 ≤ 200。

### 依賴
Step 3、4、5、6、7 全部完成。

---

## Step 9 — 向後相容驗證

### 修改
- `src/lib/AppContextInternal/provider.tsx`（useApp 簽名）

### 驗證方式

```bash
# 靜態：tsc clean
npx tsc --noEmit

# 全域搜尋 useApp() 所有呼叫點
grep -rn "const {" src --include="*.tsx" | grep "useApp()" | awk '{print $1}' | sort -u

# 確認每個呼叫點的 destructuring key 仍在新 useApp() 回傳值中
# 若有差異，在 useApp() 內補 { legacyKey: newValue } 映射

# 動態：build
npm run build 2>&1 | tail -10
```
預期：`Build: success`。

### 依賴
Step 8。

---

## Step 10（可選）— localStorage typed wrapper

### 新建
- `src/lib/storageService.ts`

### 修改
- `src/lib/storage.ts`

### 變更內容

```typescript
// src/lib/storageService.ts
import { storage } from "./storage";

export const storageService = {
  getTheme: () => storage.getString("theme") as "light" | "dark" | "system" | undefined,
  setTheme: (v: "light" | "dark" | "system") => storage.set("theme", v),
  getOnboardingStep: () => storage.getNumber("onboarding_step"),
  getFocusMinutes: () => storage.getNumber("focus_minutes"),
  // ... 其餘所有 25+ key
} as const;
```

### 驗證
```bash
grep -rn "localStorage\." src --include="*.tsx" --include="*.ts" | grep -v storageService | wc -l
```
目標：逐年降至 0。可與其他步驟並行，無阻塞依賴。

---

## 依賴圖（Dependency Order）

```
Step 1 (constants)  ─────────────────────────────────────────────────────────┐
                                                                               │
Step 2 (useWriteGuard) ─────────────────────────────────────────────────────┤
                     │                                                         │
                     └─────────────────────────────────────────────────────────┤
                                                                               │   ┐
Step 3 (AppRouterProvider) ─────────────────────────────────────────────────┤   │
                                                                               │   │
Step 4 (TasksProvider) ◄─────────────────────────────┐                        │   │
                                                     │                        │   │
Step 5 (ListsProvider) ◄────────────────────────────┤                        │   │
                                                     │                        │   │
Step 6 (HabitsProvider) ◄───────────────────────────┤                        │   │
                                                     │                        │   │
Step 7 (SharedListsProvider) ◄──────────────────────┘                        │   │
                                                                             │   │
Step 8 (AppProvider 純組合) ◄───────────────────────────────────────────────┘   │
                                                                               │
Step 9 (useApp 向後相容驗證) ◄───────────────────────────────────────────────┘
                                                                               │
Step 10 (localStorage typed wrapper — 無阻塞依賴，可隨時開始) ──────────────────┘
```

**禁止跳步的意義**：Step 4–7 全部依賴 Step 2 的 `useWriteGuard`；Step 8 依賴 Step 3–7 全部完成；Step 9 依賴 Step 8。跳步將導致 cyclic import 或型別斷裂。
