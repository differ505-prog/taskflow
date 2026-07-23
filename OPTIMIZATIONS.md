# 📋 OPTIMIZATIONS — 優化清單

> **用途**:隨手記錄當下想到但**還沒動手**的優化點,沒事想進行優化時可以隨時接續進度。
>
> **規範**:想到就寫,不要憋;但**寫下來不等於要做**。每個項目至少要寫清楚「痛點 + 預期影響 + 估算成本」,動手前再走憲法 § 14 評分表流程。

---

## ✅ 已完成(從這裡移出)

| # | 標題 | 解決方式 | Commit | 完成日 |
|---|------|---------|--------|--------|
| 1 | 收集箱捲到底被遮 | `<main>` 加 `flex flex-col` + list `flex-1 overflow-y-auto` | `ba28bf4` | 2026-07-15 |
| 2 | 子任務勾選圈圈太小 | 點擊區 28×28,圖示 18×18 + 文字可點開編輯 | `ca182cb` | 2026-07-15 |
| 3 | 子任務勾選按兩次才完成 | 移除 hover 陰影 + active scale,讓 hover 跟按下視覺一致,跟母任務圈圈行為對齊 | (本次) | 2026-07-15 |
| 4 | 日曆 task panel 滾輪連續滾動時「任務超慢出現」 | ① 全域 `scroll-behavior: smooth` 對 panel 來說是雷：wheel event 連發 = 排一堆 smooth 動畫 queue = frame 卡住。改 panel 加 `.calendar-task-panel { scroll-behavior: auto }` 覆寫;② panel `transition-all duration-200` 在滾動期間任何子元素 transition 都會重新觸發動畫 → 拿掉;③ ResizeObserver 加 `requestAnimationFrame` debounce + window resize 主動重算。驗證:`npm run build` clean | `c526b3f` | 2026-07-21 |

---

## 🟡 待評估(已確認需求,待動手)

### O-006 清單拖曳排序（自有清單）
- **痛點**:目前 Sidebar 清單只能用建立順序排列,超過 5 個就難找到。清單有 `order` 欄位但 UI 無拖曳。
- **理想**:用 dnd-kit sortable + 手柄,hover 顯示(桌機) / 永遠顯示(手機),拖曳即時同步雲端。
- **影響**:
  - UI:`src/components/Sidebar.tsx` 加 `<DndContext>` + `<SortableContext>` + `<SortableListItem>` 手柄
  - State:`src/lib/AppContext.tsx` 加 `reorderLists(newLists)` 方法 + `addList` 自動給 `order`
  - 同步:走 `batchSaveListsFirebase`,5 秒保護窗對齊 §26 類別 A
  - 不動:`personalListSync.ts`(已有 batchSaveLists / subscribeLists)
- **估算成本**:3-4 小時,1 commit,1 RFC
- **動手前**:已通過評分 9.0（dnd-kit + 手柄 + 只自有）
- **狀態**:🟡 架構 OK,等你「做下去」即可啟動

### O-007 主任務拖曳排序
- **痛點**:任務清單(Inbox / 內頁列表)目前只能拖右上 priority tag,沒辦法整筆拖曳調整執行順序。
- **理想**:dnd-kit sortable + 手柄,跨清單拖曳(將任務移到別的清單)。
- **影響**:
  - UI:`src/components/TaskListItem.tsx` + TaskList view
  - State:`AppContext` 新 `reorderTasks(listId, newTasks)` + `moveTaskToList`
  - 同步:`Task.position` 已就緒 (`sharedSync.ts` 註解提到)
- **估算成本**:4-6 小時(含跨清單拖曳治理)
- **動手前**:待 O-006 收斂後再開 RFC
- **狀態**:📐 待 O-006 完成後啟動 RFC

### O-001 子任務變成獨立任務(位階變換)
- **痛點**:目前 `SubTask` 是嵌在 `Task.subTasks[]` 裡的扁平字串陣列,只能勾/刪/編輯標題,沒辦法讓子任務自己展開 detail panel。
- **理想**:子任務跟母任務是同一種東西,只是「暫時被某個母任務收留」。母任務日後也能變成另一個的子任務,等於**無限層級遞迴**(Notion / Things 3 模式)。
- **影響**:
 - 資料層:從 `Task.subTasks: SubTask[]` → `Task.parentId?: string`(扁平 + 父子指針)
 - UI:TaskListItem 改樹狀渲染、TaskDetailPanel 也要支援打開任意任務
 - Zustand selectors:所有 `state.tasks.filter(...)` 都要改
- **估算成本**:6-12 小時,需切碎成多個 commit(資料層 / UI / 測試)
- **狀態**:📐 架構規劃中,本次未動工
- **動手前**:必須先寫詳細 RFC + 評分表 ≥ 9 分方案

### O-008 子任務拖曳排序
- **痛點**:子任務新增順序就是列表順序,沒辦法調整優先度(原 O-004 觀察中,本次升級為待評估)
- **理想**:dnd-kit sortable + 手柄,在 `TaskDetailPanel` 內拖曳排序
- **影響**:
  - UI:`src/components/TaskDetailPanel.tsx` 子任務區塊加 SortableContext
  - State:子任務目前是 `Task.subTasks: SubTask[]` 扁平字串陣列(無 order 欄位)
  - 同步:子任務隨母任務整包同步,`Task.updatedAt` 觸發
- **估算成本**:2-3 小時(待 O-006 / O-007 確認手感後再啟動)
- **動手前**:需先決定子任務要不要加 `order` 欄位(若升級為獨立任務見 O-001 則不用)
- **狀態**:📐 順序:等 O-006 → O-007 → 再啟動

---

## 🔵 觀察中(不確定值不值得做,先記下)

### O-002 TaskQuickActions 右下浮動按鈕排版
- **痛點**:點任務卡片右下角的快速動作(優先級、標籤)時,有時候會誤觸到任務標題(誤開 detail panel)
- **觀察**:要不要在 TaskCard 加 `e.stopPropagation()` 給 QuickActions
- **估算成本**:5 分鐘
- **狀態**:❓ 待您回報是否真的有此困擾

### O-003 收集箱標題右側的「全部/待辦/進行中/已完成」篩選列
- **痛點**:目前 4 個 pill 按鈕擠在一行,在窄螢幕(< 768px)可能會換行
- **觀察**:憲法 § 8 要求「並排元素防溢出」,需要量測
- **估算成本**:10 分鐘 + 量測
- **狀態**:❓ 待您下次用手機開啟時回報

### ~~O-004 子任務可拖曳排序~~（已併入 🟡 O-008）
- 原狀態:觀察中 1-2 小時
- 完整內容見 O-008

---

## 🟢 暫不做(有意識地延後)

| # | 標題 | 延後原因 | 何時重啟 |
|---|------|---------|---------|
| ~~O-005~~ | ~~任務支援 markdown 描述預覽~~ | 目前點開 detail 才看到,符合「資料與視圖分離」 | 暫不重啟 |

---

## 📌 維護公約

1. **新增項目**:直接編輯本檔,標題用動詞開頭(例:「子任務支援拖曳」)
2. **狀態流轉**:`🔵 觀察中` → `🟡 待評估` → `✅ 已完成`(移至上表)
3. **每次 Commit 前**:若本次改動屬於清單中的某項,**Commit message 末尾要附編號**(例:`feat(task-detail): 子任務可編輯 O-002`)
4. **30 天未動**:把 🔵 觀察中項目標 `⏸️ 過期`,提醒重啟評估