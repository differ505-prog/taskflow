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
| 5 | **O-006 清單拖曳排序(自有清單)** | dnd-kit `<DndContext>` + `<SortableContext>` + `SortableListItem`;手柄按鈕(GripVertical),桌機 hover 顯示 / 手機永遠顯示;touch-action: none 避 iOS Safari 衝突;PointerSensor delay 200ms tolerance 5px 避按下手柄時與 scroll 衝突;KeyboardSensor 為 a11y;`reorderLists` 重編 order + 5 秒 §26-A 保護窗 + batchSaveLists;排除系統預設「收集箱」清單(只拖用戶自建) | `5e6b2bc` | 已上線 |
| 6 | **O-007 主任務拖曳排序(同清單內)** | `reorderTasks` 對齊 `reorderLists` 模式:重編 order + bump updatedAt + §26-A 5 秒保護窗 + batchSaveTasks;AppShell `handleDragEnd` + ZenDashboard 禪模式焦點隊列拖曳已接上;註解明示「不跨清單(簡單版範圍)」,O-007 跨清單版待評估 | `acb222e` | 已上線 |
| 7 | **O-008 子任務拖曳排序** | SubTask schema 加 `order: number` 欄位 + lazy migrate 用 createdAt 兜底;`sortSubTasks` 改為 status 分組 + order 升冪;DndContext + SortableContext 包「未完成」區(已完成區維持摺疊不動);`SortableSwipeableSubTask` 包裹層不汙染原 SwipeableSubTask(§17-P 精神);PointerSensor delay 200ms/tolerance 5px + KeyboardSensor a11y;`reorderSubTasks(parentId, newTodoSubs)` 走 `updateTask` 既有鏈(子任務跨裝置同步衝突機率低,免 §26-A 保護窗) | `3eebe17` | 已上線 |

---

## 🟡 待評估(已確認需求,待動手)

### ~~O-006 清單拖曳排序(自有清單)~~ ✅ 已上線
- **完成方式**:見 ✅ 已完成 #5 (`5e6b2bc`)

### ~~O-007 主任務拖曳排序(簡單版:同清單內)~~ ✅ 已上線
- **完成方式**:見 ✅ 已完成 #6 (`acb222e`)
- **剩餘缺口(待評估)**:跨清單拖曳(`moveTaskToList`)仍**未實作**。若要用戶跨清單拖任務,需新建議項目啟動 RFC。

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

### ~~O-008 子任務拖曳排序~~ ✅ 已上線
- **完成方式**:見 ✅ 已完成 #7 (`3eebe17`)

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
| **O-009** | [Future] Shareable Rank-Up Card — 一鍵生成 9:16 IG Stories 風格晉升分享圖,搭配 `navigator.share()` 推播,目標 $0 病毒擴散 | **品牌憲法衝突**:`global.mdc` 「真實與脆弱」拒絕操縱式行銷。晉升動畫是「多巴胺瞬間」,**不該承擔推廣職責**。此外 `RankUpNotification.tsx` 註解明寫「3 秒自動淡出,不需要用戶點擊(絕對 ADHD 地雷)」,加按鈕破壞此設計 | 待**社群黏著度驗證後**再啟動:若 D30 retention ≥ 25% 並有用戶主動在 Discord/X 詢問「可以分享嗎?」,則啟動 RFC 重評 §10 評分表(屆時優先採 SnapDOM / html-to-image,而非 html2canvas) |
| ~~O-005~~ | ~~任務支援 markdown 描述預覽~~ | 目前點開 detail 才看到,符合「資料與視圖分離」 | 暫不重啟 |

---

## 📌 維護公約

1. **新增項目**:直接編輯本檔,標題用動詞開頭(例:「子任務支援拖曳」)
2. **狀態流轉**:`🔵 觀察中` → `🟡 待評估` → `✅ 已完成`(移至上表)
3. **每次 Commit 前**:若本次改動屬於清單中的某項,**Commit message 末尾要附編號**(例:`feat(task-detail): 子任務可編輯 O-002`)
4. **30 天未動**:把 🔵 觀察中項目標 `⏸️ 過期`,提醒重啟評估