# Bug 案例庫

> 本檔為 §21 SSOT 的一部分：所有修過的 bug 案例集中管理，每修完一個 bug 自動補一筆。
>
> **觸發時機**：任何 bug fix 合併到 main 後，立即 commit 一筆到本檔（與該 fix 同 commit 或緊接 commit）。
>
> **與其他 SSOT 的關係**：
> - 憲法規則索引 → `.cursor/rules/global.mdc`
> - 產品規格與已完成優化 → 已廢除（原 `優化清單.md` 整檔刪除，2026-07-21，git history 保留）
> - 未來待辦 backlog → 對話中告知，不另開檔

---

## 案例索引

| ID | 標題 | 根因類別 | 修法 commit | 日期 |
|----|------|---------|-----------|------|
| #001 | 點 chip filter 後 toolbar 整排消失（§26 類別 E + §26 類別 N 候選） | 修錯層 / 嵌套 ternary 外層未修 | `8775fe2` | 2026-07-21 |
| #002 | 「今天先這樣」按鈕審計：commit `f3c4bac` 修了內層 ternary 沒修外層 | §26 類別 N 候選 / 嵌套 ternary 修錯層 | `8775fe2` | 2026-07-21 |
| #003 | ESC 退回日曆後任務 sheet 永久消失，所有任務再也點不開 | §26 類別 O' / 雙 hook 獨立 state 死鎖 | `69feb42` | 2026-07-22 |
| #004 | 任務多時最後一個任務被底部截斷，滑不到 | 容器 `overflow-y-auto` 的 `pb` padding 在裁切邊界內失效 | `89082d7` | 2026-07-22 |
| #005 | 象限雷達桌面 2x2 滾動錯位（單獨一卡片能滑、其他三張靜止），且 grid 高度被 1fr 鎖死 | view pattern vs page pattern 混用（候選 §26 類別 P） | `6f5c2ca` | 2026-07-24 |
| #006 | 幽靈按鈕 1 週靜默期後再點無反應，客人以為按鍵故障 | hook 出口缺失 + GhostButton 已實作 `dismissed` prop 但無父層傳入 | `a6b7ea4` | 2026-07-26 |
| #007 | 手機版點底部「今天」 → 「頁面錯誤，請重新整理」，重新整理也沒恢復 | React Hooks Rules 違規：`useProactiveClosure` 被放在條件 IIFE 內 | `c114f8c` | 2026-07-28 |
| #008 | 切換帳號後舊 uid 任務仍顯示 + 觸發孤兒補推 RLS 403 + 同 session 切換污染 | §26 類別 J：localOnly 無 ownerUid filter + firstLoadDone 跨 uid 未重置 | `aaf7e47` + `69c0204` | 2026-07-28 |
| #009 | 點「已完成」狀態 chip 後畫面空白,有 3 個 done 卻不渲染 | activeTasks 拆分時 `explicitlyShowingDone=true` 變 0 + L6.5 折疊區被 `!explicitlyShowingDone` 跳過 | `efac784` | 2026-07-29 |
| #010 | 「開始暖身」fixed bottom 按鈕垂直對齊偏低,icon 跟文字擠在底部 | inline style `paddingBottom: env(safe-area-inset-bottom, 0px)` 覆蓋 Tailwind `py-2` 的對稱 padding-bottom(在桌面環境 env() 永遠 = 0);CSS specificity: inline style > className | `a857ffa` | 2026-07-29 |
| #011 | 禪模式「跳過」按鈕按了沒反應(區間任務 startDate 跟 dueDate 撕開,selectZenTasks 仍命中) | `escapeTask` startDate 分支只更新 startDate 不動 dueDate(區間長度為 0 撕開);`selectZenTasks` 只看 `dueDate === today` 不看 startDate | `b54ce30` | 2026-07-29 |
| #012 | 完整 push 鏈條：無法重新訂閱 → SW 卡死 → favicon 404 → middleware 攔 sw.js → subscribe API id 缺欄 → 測試推播第二次後 tag 去重不彈 banner | 10 個 commit 才完整打通整個 push 鏈條；每個 commit 各自命中不同層次的真根因 | `a0386d3` ~ `e076783` | 2026-07-30 ~ 2026-08-02 |
| #013 | 任務詳情面板卷到底部卷不回去 + 禪模式升級後等級 UI 沒同步 | 待定位（Bug A 滾動 + Bug B 禪模式 level state sync） | （待修） | 2026-08-02 |
| #013-A ✅ | 任務詳情手機版卷不回去(三層 overflow 衝突) | 命中 §26 類別 B + §15.3 雙 scroll container 陷阱;AppLayout 中間多餘 div + TaskDetailPanel panelRef overflow-hidden + scrollRef 缺 min-h-0 | `3da471c` | 2026-08-02 |
| #013-B ❌ | 經驗條滿時 PP 被重置為 0 + 重置後再次完成任務從 0 開始 | ❌ 失敗,待定位:已試過 root cause 1.ProgressBadge state isolation(被「重置後從 0 開始」排除) 2.hydratedRef dead code(非 reset 路徑) 3.多 caller race condition(無 runtime 證據);grep `localStorage.setItem` 全文只有 `useProgressStatus` 寫,沒看到 `writeToStorage(0)` 路徑;下一步需要 runtime 證據:console.log 在跨門檻前後觀察 localStorage + addPp 呼叫鏈 | （待修） | 2026-08-02 |
| #014 ✅ | 清單任務列表手機版卷到底卷不回去 | 命中 §26 類別 B + §15.3 雙 scroll container 陷阱;跟 Bug A #013-A 同源 pattern:AppShell L489 外層 `overflow-hidden` 跟 L493 內層 `overflow-y-auto` 衝突;Bug A 修完只改了 TaskDetailPanel,沒改 AppShell 同根因 | `531ea5e` | 2026-08-02 |
| #014-r2 ✅ | 第 1 輪修 AppShell L489 overflow-hidden 後症狀從「卡住」變成「過度滾動」;第 2 輪定位:真根因是 PullToRefresh L71 `touchAction: "pan-down"` 禁止向上 pan,瀏覽器無法把向上拖動交給內層滾動容器 | `0f29168`(PullToRefresh touchAction "pan-down" → "pan-y") | 2026-08-02 |
| #014-r3 ✅ | 第 2 輪修完 PullToRefresh touchAction 後症狀變成「向下 ok、向上不 ok」;第 3 輪引用 dnd-kit 官方文件 + Stack Overflow 已知修法定位:真根因是 AppShell L252 `PointerSensor` 在 iOS Safari 已知限制 — touchmove 期間無法可靠 preventDefault,sortable item 抓走所有 touch event,內層 scroll container 收不到向上 pan | `1e39058`(sensors 改為 MouseSensor + TouchSensor(delay: 250, tolerance: 8);SortableTaskItem 加 touchAction: pan-y wrapper) | 2026-08-02 |
| #014-r4 ✅ | 用戶環境:iOS PWA(主畫 icon),非 Safari tab;第 3 輪修法未涵蓋 PWA freeze → state stale 場景;第 4 輪治標:手機版 (`max-width: 767px`) 直接 disable sortable (`canDrag = !currentSharedListId && !isMobile`) → SortableContext 整個不掛,touch event 不再走 dnd-kit 路由 | `4c3cc41`(AppShell 加 isMobile matchMedia + canDrag 過濾) | 2026-08-02 |
| #014-r5 ❌ | 第 4 輪治標(disable sortable)後症狀變成「滑到底不 ok」;我定位為 iOS PWA 內外層 overscroll 傳遞,加 `overscroll-behavior: contain`。**結果:用戶硬往上拖仍卡死,證明這個診斷是錯的**(overscroll 已 contain 但內層還是收不到向上 pan)。這個 commit 是「假修復」 | `b309908`(PullToRefresh inline style 加 overscroll-behavior: contain;**沒生效**) | 2026-08-02 |
| #014-r6 ✅ | 真正 root cause(另一位 IDE 一次命中):PullToRefresh L26 `if (window.scrollY <= 0)` 用 window scrollY 判斷頂部,但任務列表是在內層 scroll container 內滾動 → window.scrollY 永遠是 0 → 當用戶在列表底部「想向上滑」(手指物理方向向下)時,PullToRefresh 誤觸發 + 鎖死 touch event,內層 scroll 收不到滾動事件。**真正修法**:touchstart/touchmove 改用 `containerRef.scrollTop === 0` 精準偵測真實頂部 + `touch-action: pan-y` 雙向放手 | (另一位 IDE 推 main,本對話僅登記) | 2026-08-02 |
| #015 | 禪模式「下一個輪值」按鈕按了沒反應(焦點未切換) | `reorderTasks` 內部用 `tasks.map(...)` 保留 React state 物理位置 + `selectZenTasks` 純 filter 沒 sort by `order` → `order` 已重編但 `visibleTasks[0]` 物理位置不變 → FocusCard `key={focus.id}` 不變 → AnimatePresence 不換 focus | `fix(zen): selectZenTasks sort by order` | 2026-08-03 |

---

## #001 — chip toolbar 點擊後整排消失

### 症狀（用戶描述）
- 在 Vibe Coding 清單（3 個任務）點「進行中」chip
- Vibe Coding 沒有進行中任務 → displayTasks 變 0
- 整個 toolbar（含 chip、「今天先這樣」、列表/網格切換）一起消失
- 中央出現「尚無任務 / 開始建立你的第一個任務」+「新增任務」按鈕
- 用戶找不到 chip 切回其他 filter，陷入「找不到回頭路」陷阱

### Root Cause（§26 類別 E 修錯層 + §26 類別 N 候選）
- `AppShell.tsx` 第 419 行有外層 ternary：`displayTasks.length === 0 ? <EmptyState/> : <>{toolbar + tasklist}</>`
- `f3c4bac` 修了 ternary 內層結構（把 toolbar 移到永遠渲染位置）
- **但**外層 ternary 在 toolbar 上方就切換走 EmptyState → toolbar 永遠到不了
- f3c4bac 修的是「內層 ternary 的內部結構」，沒動「外層 ternary」→ 真根因沒被治本

### 修法
- 把外層 ternary 拆解為 toolbar 內部條件 + task list 內部條件
- toolbar 用 `currentView !== "inbox"` 條件永遠渲染（保留 Brain-dump 哲學）
- EmptyState 與 task list 改為 toolbar 下方的 conditional sibling
- inbox 視圖保留原 Brain-dump 行為不變

### 驗證（§12）
- `npm run build` → exit 0，20 routes 全部 build 成功
- 推 main → Vercel production deployment 觸發
- 用戶確認 chip 在 displayTasks 空時仍可見可切換

### 教訓（轉化成修憲候選）
- **§26 類別 N 候選**：修 ternary 嵌套時，**只修內層不算修完**。必須 grep 同檔所有 `? : ` 三元確認上層切換邏輯。
- **§15.6 純樣式 0 tool call**：本 bug 純 JSX 結構修，無 runtime 驗證需求（建構成功即可）。

---

## #002 — 「今天先這樣」按鈕：連續 3 個 commit 都在修同一個 UI bug

### 症狀（連續修 3 次的同一個 bug）
- **commit `d1e204c`**：fix(status filter chip 點擊後消失) — 第一次修
- **commit `f3c4bac`**：fix(把 chip toolbar 移出空狀態判斷) — 第二次修
- **commit `8775fe2`**：fix(chip toolbar 在 displayTasks 空時仍渲染) — 第三次修（本次根治）

### Root Cause（同 #001，§26 類別 N 候選）
- 三次 commit 都圍繞同一個嵌套 ternary
- 前兩次只觸及內層 ternary 結構（chip 渲染位置）
- 第三次才找到外層 ternary（`displayTasks.length === 0 ?`）才是真切換點

### 修法（同 #001）
- 一次性重組 ternary 結構
- toolbar 用 `currentView !== "inbox"` 條件永遠渲染

### 教訓（轉化成修憲候選）
- **§16b 強化版**：同一個 UI bug 第二次修復失敗時，**必須停下 grep 同檔所有 ternary**，禁止繼續悶改。
- **§14.2 候選**：修 UI bug 之前，必須先列「所有 ternary / branch 上層切換點」清單（grep `? : ` 確認切換鏈）。
- **§15.5 失敗上限觸發**：本案例累計 3 次修改才解決，正好踩到 §16 上限，差一次就觸發強制停下報告。

---

## #003 — ESC 退回日曆後任務 sheet 永久消失

### 症狀（用戶描述）
- 在日曆視圖點某個日期 → 任務清單 sheet 彈出 ✅
- 點某個任務 → 詳情面板跳出 ✅
- 按 ESC 鍵 → 詳情面板關閉 ✅，但 **任務清單 sheet 也消失**
- **之後點任何日期都不會再彈出任務清單 sheet**，所有任務再也點不到
- 只能 reload 整頁才能恢復

### Root Cause（§26 類別 O' / 雙 hook 獨立 state 死鎖）

**雙 hook 獨立 state 死鎖**：
1. `CalendarTaskSheet` 同時使用了兩個不相關的 state 來控制同一個 UI：
   - `selectedDate`（由 `CalendarView` / `AppLayout` 管理）— 決定 sheet 是否渲染
   - `useBottomSheet` 的 `internalLevel`（由 hook 自己管理）— 決定 sheet 內部展開狀態

2. `useBottomSheet` 內部有一個 ESC listener：按下 ESC 時把 `internalLevel` 設為 `"closed"`

3. **但** `CalendarTaskSheet` 的 `if (!selectedDate) return null` **不會 unmount sheet**，只是 return null 隱藏元素。sheet 元件仍在記憶體中，`useBottomSheet` 的 `internalLevel` 卡在 `"closed"`

4. 下次點同一日期 → `selectedDate` 變有值 → sheet 重新顯示 → 但 `useBottomSheet` 內部 `internalLevel` 仍是 `"closed"` → `isOpen = false` → sheet 永遠不顯示

### 修法
- `CalendarTaskSheet` 內加 `useEffect`：當 `selectedDate` 有值時，主動呼叫 `useBottomSheet.open()` 把 `internalLevel` 重置為 `"default"`
- `AppLayout` 同時把 `selectedDate` 狀態從 `CalendarView` 提升上來，讓 ESC handler 能統一清掉

### 驗證（§12）
- `tsc --noEmit` → clean
- `npm run build` → success
- 用戶在桌面 Chrome 確認：ESC 後再點同一日期，sheet 正常彈出 ✅
- 用戶在桌面 Chrome 確認：點別的日期，sheet 正常彈出 ✅

### 教訓（§26 新類別 O'）
- **雙 hook 獨立 state 死鎖**：當一個 UI 元件同時由兩個不相關的 state 控制時，必須確保**兩者的狀態轉換是一致的**。尤其當其中一個 state 由 hook 內部管理（`useBottomSheet` 的 `internalLevel`）而另一個由外部 prop 傳入（`selectedDate`）時，外部 prop 變化必須主動同步內部狀態。
- **第一次修失敗就停下問診**：本案例第一次修了 AppLayout（加 `setCalendarSelectedDate(null)`）但沒修到真切換點，浪費一次 commit。直到第二次確認真正根因在 `useBottomSheet` 的 `internalLevel`，才找到正確修法。
- **commit `38e5abc` 沒生效**：第一次修完後即使用戶 hard reload、生產環境已部署，症狀依舊。提醒：tsc clean / build success 只是必要條件，不保證修法邏輯正確。

> 每次修完 bug：複製下方模板，填入根因 + 修法 + commit hash，然後 commit。
>
> ```markdown
> ## #00N — <簡短標題>
>
> ### 症狀（用戶描述）
> - <具體症狀 1>
> - <具體症狀 2>
>
> ### Root Cause（對應 §26 類別 X）
> - <根因說明>
>
> ### 修法
> - <改了什麼檔案 / 行數 / 邏輯>
>
> ### 驗證（§12）
> - <build / tsc / runtime 結果>
>
> ### 教訓（轉化成修憲候選 or 命中既有類別）
> - <這次教訓值得新增哪條規則>
> ```

---

## #004 — 任務多時最後一個任務被底部截斷，滑不到

### 症狀（用戶描述）
- 任務數量足夠多、列表可滾動
- 滾到底部時，最後一個任務被底部區域（FAB / 輸入框）截斷
- 滑不到最後一個任務的完整內容

### Root Cause（overflow padding 裁切邊界陷阱）

`AppShell.tsx` 滾動容器的 `overflow-y-auto` 與 `pb-[calc(...)]` 共存於同一元素：

```
<div className="... overflow-y-auto px-6 py-5 pb-[calc(...)]">
```

`overflow` 會建立 **裁切邊界（BFC）**，`padding` 在邊界**內**計算。裁切邊界內的 padding-bottom 空間被裁掉，永遠不可見。

**類似的已知陷阱**：當 `overflow: hidden` / `overflow: auto` 與 `padding` / `box-shadow` 同時存在，padding 和 shadow 會被裁切。

### 修法

將 `pb` 從滾動容器移到**內容層**：

```tsx
// 滾動容器：移除了 px py pb
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain h-full md:pb-5 ...">

// 新增內容層：接收原本的 padding
<div className="px-6 py-5 pb-[calc(72px+env(safe-area-inset-bottom,0px)+16px)] min-w-0 flex flex-col flex-1">
  {/* 實際內容：Viewer 提示、Shared List View、Normal View */}
</div>
</div>
```

`overflow-y-auto` 仍在容器層，裁切邊界仍在；但 `pb` 在內容層（裁切邊界**外**），padding 空間可正常發揮，最後一個任務完整可見。

### 驗證（§12）
- `npm run build` → exit 0
- 推 main → Vercel production deployment 觸發
- 用戶確認任務多時最後一個任務完整可見、可滾動到底

### 教訓
- **`overflow` 裁切邊界陷阱**：`overflow: auto/scroll/hidden` 會建立 BFC，該元素自身的 `padding` / `box-shadow` / `border-radius` 超出部分會被裁切。若需要有額外空間（底部墊 FAB 高度），padding 必須放在**內容層**，不能放在裁切元素自身。
- **§15.3 佈局 Bug 第一刀**：視覺症狀「底部截斷」→ 檢查 `overflow` 屬性 + 父層 `overflow` 鍊 → 確認裁切邊界位置 → 將 padding 移至 overflow 容器內層。
- **純 Tailwind 改動**：此修法是樣式重構，無跨元件邏輯影響，build clean 即為充分驗證。

---

## #005 — 象限雷達桌面 2x2 滾動錯位（單獨一卡片能滑、其他三張靜止）

### 症狀（用戶描述）
- 在桌面（≥ md 寬度）打開「象限雷達（Quadrant Radar）」視圖
- 4 個象限以 2x2 排列（Q1/Q2 同一 row、Q3/Q4 同一 row）
- 內含較多任務的象限卡片出現「自己可以滑」，但其他三張卡片高度靜止不動 → 卡片底部對齊混亂
- 任務數多的卡片可能出現「底部被 grid 1fr 鎖定的卡片高度截斷」的現象
- 行動裝置（1 欄）曾有「最後任務滑不到」症狀，由上輪 `c64e7a2` 補 main 的 `overflow-y-auto` 修了底部裁切

### Root Cause（view pattern vs page pattern 混用）

`QuadrantRadarView` 是被 `AppLayout` 嵌入的 **view 元件**（透過 `currentView === "quadrant"` 切換），不是 page。但元件內部用了 **page pattern** 寫法：

```tsx
// Page pattern（只有 standalone page 才適用）
return (
  <div className="min-h-screen flex flex-col">     // ❌ 視窗高度，view 應承接父層 h
    <header>...</header>
    <main>
      <div className="grid grid-cols-2 h-full" style={{ gridAutoRows: "minmax(220px, 1fr)" }}>
        {cards.map(c => <Card className="... overflow-y-auto">...</Card>)}   // ❌ 每張卡片自己滑
      </div>
    </main>
  </div>
);
```

兩個獨立症狀來源：

1. **`min-h-screen` 取代 `h-full`**：`AppLayout` 已用 `h-[100dvh] overflow-hidden`（§7 防橫向 overflow）撐住 flex 高度鏈，子 view 應該用 `h-full` 承接父層高度。用 `min-h-screen` 等於 view 跟 viewport 解耦 → 父層 flex 高度永遠無法正確分配給 grid → 桌面 2x2 撐到內容高度後多餘空間交給 `1fr` 鎖定平均分。

2. **`gridAutoRows: "minmax(220px, 1fr)"` + 卡片內獨立 `overflow-y-auto`**：grid 用 `1fr` 把多餘空間平均分給每個 row；而每張卡片自己 `overflow-y-auto` 後，row 高度可以小於卡片實際內容（卡片在自己的 scroll container 內滑）→ 同 row 高度 = max(內容)，但因為 row 由 1fr 鎖，單張滑的時候另一張靜止。

### Codebase 既有 view pattern（這次對齊的基準）

| 元件 | 頂層 class | 滾動責任 |
|---|---|---|
| `AppShell` L419-423 | `<div className="flex flex-col min-h-0 w-full h-full overflow-hidden">` → 內層 main `overflow-y-auto` | 自身定上游,view 走 `h-full` |
| `CalendarView` L206 | `<div className="h-full flex flex-col min-h-0 ...">` | 同上 |
| `TaskDetailPanel` L439 | `<div className="h-full flex flex-col">` | 同上 |
| `QuadrantRadarView`（修前） | `<div className="min-h-screen flex flex-col">` ❌ | **唯一不一致** |

### 修法（3 處 className 對齊）

| 位置 | 改前 | 改後 | 目的 |
|---|---|---|---|
| L240（root） | `min-h-screen flex flex-col` | `h-full flex flex-col` | 對齊 codebase view pattern（不再用 page 級高度） |
| L276（grid） | `h-full` + `gridAutoRows: minmax(220px,1fr)` | `auto-rows-auto` | 內容決定 row 高度，不再用 1fr 鎖平均分 |
| L138（卡片內） | `flex-1 min-h-0 px-3 py-2 overflow-y-auto` | `flex-1 min-h-[160px] px-3 py-2` | 移除卡片獨立 scroll；統一滾動權交還給 main（main 已有 `overflow-y-auto`，由上輪 c64e7a2 加） |

桌面 2x2 預期：Q1+Q2 同 row 由 max(內容) 撐高，Q3+Q4 同 row 同理，row 高度可不同但同 row 對齊。Main 自身仍是 scroll container。
行動 1 欄：4 個 row 由內容依序撐高，main 統一滾。卡片至少 `min-h-[160px]` 確保空象限也可見。

### 驗證（§12）
- `npx tsc --noEmit` → exit 0，clean
- `npm run build` → exit 0，20 routes + middleware 全部 build 成功
- GitHub push → `main @ 6f5c2ca`，Vercel production 自動觸發部署
- 用戶確認象限雷達桌面 2x2 與行動裝置 1 欄皆正常：滾動統一、滑到底可見、卡片高度一致

### 教訓（轉化為 §26 修憲候選 — 類別 P）
- **§26 類別 P 候選**：view 元件 vs page 元件混用 — page-level 用 `min-h-screen` + 自有 scroll；view-level（被 `AppLayout` 嵌入）必須 `h-full` + 滾動責任在 AppLayout 的 main。判定法：grep 該 component 是否被某 ternary / route 直接 mount；若是被嵌入 `AppLayout` / `SidebarLayout` 的 child view → 必須 view pattern。
- **§15.3 視覺症候第一刀延伸**：當 grid 在 view 元件內產生「單獨一格可滑」「格高被鎖」「row 對齊錯」三種症狀任一出現時，第一個動作是檢查**該 view 頂層是不是 page pattern**（`min-h-screen` / `h-screen` / `height: 100vh`）而不是 `h-full`。
- **先列 view pattern 對照表**：修正 view 元件之前，先 grep 同類 view（`CalendarView`, `TaskDetailPanel`, `ArchivedTasksView` …）對齊主流寫法，避免「只修這一個、不一致點繼續累積」。
- **不是每個 bug 都觸發新公約**：本案例這次僅登記為 §26 類別 P 候選（先收集案例，未來累積到 ≥2 個同類 bug 再正式提出公約）。

> 每次修完 bug：複製下方模板，填入根因 + 修法 + commit hash，然後 commit。

本區記錄每次新增 §26 bug 類別背後的觸發案例、修憲原因與自評分。資料來源：`.cursor/rules/global.mdc` 生效紀錄。

| 日期 | 變更 | 自評分 |
|------|------|--------|
| 2026-07-19 | 新增 §10.3 修憲自評分公約 + §15.7 Runtime 預算揭露 + §15.8 悶做攔截 + §21.7 跨 repo SSOT + §26 類別 G/H（build 失敗隱形上線 / client/server 元件邊界衝突） | （本表自評） |
| 2026-07-20 | 新增 §26 類別 I：PostgREST 把函式內部 PostgreSQL error 包裝為 404（42883 等），掩蓋真根因；本輪修了 4 輪才從 Logs 發現 SQLSTATE；新增前自評 9.2，達標 | **9.2**（首輪即達標，免二輪） |
| 2026-07-20 | 新增 §14.1（build/type 報錯全鏈條清理）— 針對本輪 deletedIdsRef type 改了 3 輪才完整（每次 build 才看到下一錯）；新增 §26 類別 J（孤兒任務自動補推）— 針對「localOnly=15 跨裝置永遠看不到」的具體根因 | **§14.1: 9.3 / §26-J: 9.2**（均首輪達標，免二輪） |
| 2026-07-20 | 新增 §24.1 瀏覽器子模式首次確認（涵蓋 PWA / Safari tab / WebView 子模式差異，避免把 Safari tab 行為誤套 PWA）+ §26 類別 K（瀏覽器子模式假設錯誤）；本輪 iOS PWA 同步延遲修了 N 輪才發現是 PWA 進背景 iOS 凍結 WebSocket — 治本加 PWA 喚醒同步（visibilitychange + pageshow + online 三事件）已驗證 < 1 秒同步 | **§24.1: 9.3 / §26-K: 9.2**（均首輪達標，免二輪） |
| 2026-07-21 | 新增 §26 類別 L：跨平台/Web API 方案評估沒查 caniuse/MDN 精準支援矩陣，且 feature-detect 用「近似 payload」（如 `text/plain` 測 `canShare` 但實際分享 `application/json`）導致誤判；本輪 Web Share API 評估時自信「手機都適用」，實則 iOS <15、Chrome Android <86、Firefox Desktop 不支援，且 MIME 測試錯誤；commit f6f73e2 已修正 canShareFiles 用真實 JSON MIME 測試；觸發修憲前自評 9.1 | **9.1**（首輪達標，免二輪） |
| 2026-07-21 | 新增 §26 類別 M：Next.js App Router 把 client-side Context Provider 放在「可被路由旁路的 layout 內」（P0-2 hotfix: ConfirmProvider 留 AppLayout 但 `/settings` `/tags` 直連 URL 不掛 AppLayout → useConfirm throw）；本對話 commit `5ef2004` 已將 ConfirmProvider 上移至 root layout (`app/layout.tsx`)；類別 M 條文強調「Provider 一律掛 root layout」+ 「驗證必跑 `npx next build`」；觸發修憲前自評 9.1 | **9.1**（首輪達標，免二輪） |
| 2026-07-21 | 新增 §14.2（UI 條件渲染切換鏈盤點）+ §26 類別 N（嵌套 ternary 修錯層）— 針對本對話 chip toolbar bug 連續 3 commit 才修對的具體根因（d1e204c → f3c4bac → 8775fe2，前兩次只修內層 ternary，第三次才找到外層切換點）；§14.2 動手前盤點切換鏈、§26 類別 N 治本拆解外層 ternary | **§14.2: 9.2 / §26-N: 9.2**（首輪達標，免二輪） |
| 2026-07-22 | 新增 §26 類別 O（React `useEffect` stale closure 漏 deps — ESC handler 條件 `if (selectedTaskId \ | \ |
| 2026-07-22 | 新增 §26 類別 O'（雙 hook 獨立 state 死鎖 — 日曆 ESC 後 sheet 永久消失,useBottomSheet internalLevel 卡在 closed 只清 selectedDate 不夠,需呼叫 open() 重置）+ 同步更新 bug案例.md #003。本對話 commit: 69feb42 | **§26-O': 9.4**(首輪即達標,免二輪) |
| 2026-07-24 | 登記 §26 類別 P 候選（view pattern vs page pattern 混用 — QuadrantRadarView 用 min-h-screen 但被 AppLayout 嵌入）+ 同步更新 bug案例.md #005。本對話 commit: 6f5c2ca。**只登記候選、不寫正式公約**：目前僅 QuadrantRadarView 單一個案，未來累積到 ≥2 個同類 bug 再正式提公約 | **候選自評 8.8**（已達累計門檻 9.0 之下,故不正式入條；本筆記供未來參考） |

---

## #006 — 幽靈按鈕 1 週靜默期後再點無反應，客人以為按鍵故障

### 症狀（用戶描述）
- 點「無聲營地」或「啟動魔力消耗條」幽靈按鈕 → 第一次 Modal 出來
- 點 Modal 任何位置（背景 backdrop / 「先不用了」 / 「加入候補」 / ESC）後 Modal 關閉
- **1 週內再次點同按鈕 → 完全無反應**（沒有 modal、沒有任何視覺/聽覺回饋）
- **重新整理網頁後再點 → 仍然無反應**
- 客人直覺判斷為「按鍵壞了」,不會知道是設計意圖的「禁止煩人」靜默期

### Root Cause（hook 出口缺失 + GhostButton 視覺盲點）

兩個並行問題：

1. **`useGhostButton` 沒有把 `dismissed` 出口給父層**
   - hook 內部有 `dismissed` state（行 87）追蹤用戶是否已訂閱
   - 但 `UseGhostButtonReturn` interface **只暴露 `open` / `handleClick` / `handleDismiss` / `handleJoin`**
   - 父層無法知道目前是 dismissed 狀態,只能繼續渲染「未訂閱」樣式
   - §18d 重述確認：這是 §13「最小變更」鐵律下的設計失序 — 為了不擴大範圍，**hook 沒出口 dismissed**，**結果把「視覺永遠正常」當成默認**,沒人意識到「dismissed 後視覺應該變」

2. **`GhostButton` 元件已實作 `dismissed` prop 但無父層傳入**
   - 元件 interface 早就定義了 `dismissed?: boolean`（行 45），且 `aria-label` 也有對應處理
   - **但 5 個幽靈按鈕使用點（`timebar` / `body_doubling` / `unlimited_shred` / `pro_themes` / 共用元件）都沒人傳 `dismissed={...}`**
   - 永遠 `dismissed = false` 預設值 → 按鈕永遠顯示「未訂閱」樣式
   - §14.1 全鏈條掃描才能發現這個失序 — 從單一檔案看會以為「元件已支援」,實際上沒人用

兩個問題疊加 → 1 週靜默期內,**視覺永遠是「未訂閱」樣式**,點擊卻 **永遠無反應**,客人只能猜是 bug。

### 修法（B4 雙保險方案）

| 改動 | 檔案 | 範圍 |
|---|---|---|
| 1. `useGhostButton` 加 `dismissed` 出口 + 點擊 dismissed 時呼 toast | `src/hooks/useGhostButton.ts` | hook return 多一個 `dismissed: boolean` 欄位；行 94-100 dismissed 分支加 `toast.success("已加入提醒,1 週內不再彈窗", { description: "這是尚未推出的 Pro 功能預約,到時會通知你。" })` |
| 2. `GhostButton` 已訂閱狀態顯示「已記錄」徽章（取代鎖頭） | `src/components/GhostButton.tsx` | 改 import `BellRing` 取代單一 `Lock`；按鈕根元素加 `data-dismissed` 屬性 + `title` tooltip；`dismissed` 為 true 時改用 dashed border + 降透明度（不要灰到完全看不出是 Pro）+ BellRing 圖示（取代 Lock）；新增 `data-testid="ghost-button-subscribed-badge"` |
| 3. 4 個使用點傳 `dismissed={ghost.dismissed}` | `ZenDashboard.tsx` / `TaskForm.tsx` / `SettingsPage.tsx` | 每個 `<GhostButton>` 加 prop（涵蓋 `timebar` / `body_doubling` / `unlimited_shred` / `pro_themes` 全部） |

### 驗證（§12）
- `npx tsc --noEmit` → exit 0，clean
- `npm run build` → exit 0，25 routes + middleware 全部 build 成功（用戶案例 #006 之前）

### 教訓（轉化成 §26 修憲候選）
- **§26 類別 Q 候選 — hook 出口缺失 + 元件 prop 已實作但無父層傳入**：當元件 interface 已定義某個可選 prop（如 `dismissed`）但無任何使用點傳入時，**等於 prop 形同虛設**。判定法：grep 元件 prop 定義 + grep 所有使用點，確認 prop 真的有值傳入。**治本**：typeScript 應該讓必填 prop 不能無值傳入，但這會破壞 API 彈性。
- **§25 既有防護對齊**：使用既有 `sonner` toast API（§15 之外的標準 pattern），不重發明 toast hook。
- **§7 防禦性 UI 延伸**：客人不會知道 1 週靜默期設計 — **靜默期的視覺狀態必須可辨識**(已記錄/已訂閱)，不能讓按鍵「看起來能按但按了沒反應」。
- **§13 最小變更鐵律反思**：為了不擴大範圍，hook 沒出口 `dismissed` 是合理選擇；**但若配合元件的 `dismissed` prop 也沒人用**，失序就累積了。**教訓**：元件已實作但未使用的 prop 是「半完成 state」，code review 應主動揭露。

---

## #007 — 手機版點底部「今天」 → 「頁面錯誤，請重新整理」,重新整理也沒恢復

### 症狀（用戶描述）
- 手機版（mobile PWA / Safari tab 任一）點底部導航的「今天」按鈕
- 頁面跳轉到錯誤頁（字面命中「頁面錯誤,發生非預期錯誤,請重新整理」)
- 按重新整理按鈕 → **錯誤持續存在,沒有恢復**
- 桌面版因 layout 寬 chip 永遠顯示所以未觸發症狀（窄螢幕才會 hit IIFE 條件為 false 的情境）

### Root Cause（React Hooks Rules 違規）
- `src/components/AppShell.tsx` 第 525-538 行（原 line）把 `useProactiveClosure` 放在「今天先這樣」按鈕的條件 IIFE 內：
  ```tsx
  {!["today", "next7days", "list", "archived"].includes(currentView) &&
    filteredTasks.some((t) => t.status !== "done") && (() => {
      const { wrapUp, wrapping } = useProactiveClosure({  // ← Hooks Rules 違規
        onBeforeWrap: async (pending) => { ... },
      });
      return <button>今天先這樣</button>;
    })()}
  ```
- `useProactiveClosure.ts:42` 內部用了 `useState`,**它是真正的 React Hook**
- 點「今天」後 `currentView="today"` → IIFE 條件變 false → 這次 render `useProactiveClosure` **沒被呼叫**
- 但 inbox / list / 全部 等其他 view 的 render 有呼叫
- React 偵測到「**Rendered fewer hooks than during the previous render**」
- React 拋錯 → 接住 → 顯示「頁面錯誤,請重新整理」
- 「重新整理也沒恢復」:reload 後 state 重載 → `currentView=inbox` 切到 `today` → IIFE 條件再變 false → render 又少一個 hook → 又炸
- **第二次同症狀才發現是個 hooks 違規**,第一輪看症狀「點今天就壞」會以為是 routing 或專屬頁面問題

### 修法（A 方案 / hook 搬頂層 + 按鈕條件渲染）
| 改動 | 檔案 | 範圍 |
|---|---|---|
| 1. `useProactiveClosure` 從條件 IIFE 內搬到 `AppShell` 函式頂層 | `src/components/AppShell.tsx:218-232` | 新增 `const { wrapUp, wrapping } = useProactiveClosure({...})`(加 `showWrapUpButton` 衍生 boolean)|
| 2.「今天先這樣」按鈕從 IIFE 三元改為 `{showWrapUpButton && <button>...}` | `src/components/AppShell.tsx` toolbar 區塊 | 移除原本 16 行 IIFE,改為 14 行單純條件渲染 |

- 零行為改變,行為 100% 等價（hook 在 render 階段永遠執行）
- Hook 出口穩定,條件切換不會再影響 hooks 呼叫數

### 驗證（§12）
- `npx tsc --noEmit` → exit 0,clean
- 後續 §15.6 評估：純 JSX 結構/hook 位置修,**純樣式/結構 0 tool call 上限**,無 runtime 驗證需求(滿足 §15.6)
- 用戶驗證：手機版點「今天」「收集箱」「清單」「全部」四個 view 任一來回切換都不再炸

### 教訓（轉化成 §26 修憲候選）
- **§26 類別 R 候選 — React Hooks Rules 違規（hook 放在條件/IIFE 內）**:症狀鐵三角 = (a) view/state 切換時崩潰 (b) 重新整理無效 (c) ErrorBoundary 拋「Rendered fewer hooks」錯誤。判定法：grep `useState|useEffect|useCallback|useRef|useMemo|useApp|useConfirm|useProactiveClosure` 等所有 hook 出口,確認**全部在函式頂層宣告,沒有任何一個在條件/IIFE/迴圈內**。**治本**：ESLint `react-hooks/rules-of-hooks` rule (`error` 等級),建構即擋;TypeScript 無法抓這個錯誤。
- **§27 debug 流程驗證**:本 bug 完全符合 §27 debug 流程 — 先讀 SSOT(`OPTIMIZATIONS.md`)確認「今天分頁錯誤」不在 backlog → 新增觀察 → grep 同檔所有 hook call（§14.1）→ 發現 IIFE 內 hook → 修復。沒有走盲改循環。
- **§26 類別對照**:這不是「雙 hook 獨立 state 死鎖」（§26 類別 O'）,也不是「嵌套 ternary 修錯層」（§26 類別 N）,而是**hooks 呼叫數依 runtime condition 變動**這個獨立類別。雖然同樣是 React Hooks 錯誤家族,但根因機制完全不同,需獨立登記候選。
- **§15.6 純結構修 0 tool call**:本修法純結構調整(hook 位置 + JSX 條件渲染),不需要 runtime/CDP/瀏覽器驗證 — 通過 tsc 即可,符合 §15.6 純樣式/結構類 0 tool call 上限。

---

## #007 — 切換帳號後舊 uid 任務觸發孤兒補推 RLS 403

### 症狀（用戶描述）
- 電腦版 Safari 切換了帳號（從舊帳號 uid A → 新帳號 uid B）
- 切換後任務列仍顯示舊帳號的 47 筆任務，遲遲不消失
- Console 出現大量錯誤：
  - `[personalTaskSync] batchSaveTasks error: {code: '42501', ... 'row-level security policy'}`
  - `[SUBSCRIBE TASKS] callback uid=ef1c519f... fbTasks=0`
  - `[SUP SYNC] 自動補推 47 個孤兒任務上雲`（觸發 §26 類別 J）

### Root Cause（§26 類別 J）
- `saveTasks` 把**所有 uid 的任務**存在同一把 localStorage 鑰匙
- 切換帳號後舊 uid (A) 的任務殘留本地
- 新 uid (B) 的 Supabase 訂閱成功後返回 0 筆任務（因為 B 是乾淨帳號）
- subscribeTasksSync 的 `localOnly` 篩選 `!fbIds.has(t.id)` → 47 筆舊 uid 任務被視為「本地獨有」
- `orphans = localOnly.filter(t => !isWithinRecentWriteWindow(t.id))` → 全部 47 筆都是 orphan（不在 5 秒寫入窗）
- `batchSaveTasksFirebase(user.uid=B, orphans)` → 把 A 的任務用 B 的 uid 寫入 → **RLS 403 Forbidden**
- **同 session 切換（不登出）時**：`firstTasksLoadDone.current` 跨 uid 沒重置 → 新 uid 第一個 callback(fbTasks=0) **仍執行 merge** → 把舊 uid 任務寫入 React state → 污染

### 修法（commit `aaf7e47` + `69c0204`）
1. **Task schema 加 `ownerUid?: string`** — 每個任務 tag 建立者 uid
2. **storage.ts 加 `LAST_USER_UID_KEY` + `updateLastUserUid()` + `clearTasksIfUserChanged()`** — localStorage 追蹤當前 uid
3. **AppContext `addTask` / `quickAddToShared`** — 新任務加 `ownerUid: user.uid` + `updateLastUserUid`
4. **AppContext `subscribeTasksSync` localOnly 階段** — 加 `(!t.ownerUid || t.ownerUid === user.uid)` filter
   - 根治：舊 uid 任務不再被視為「孤兒」，不再觸發 RLS 403 上傳
5. **AppContext init useEffect** — `updateLastUserUid(user.uid)` 更新追蹤 key
   - 根治：跨 session localStorage uid tag，下次切換能被偵測
6. **`firstTasksLoadDone.current = false` + `firstListsLoadDone.current = false`**
   - 根治：同 session 切換帳號時，新 uid 的第一個 callback 被正確跳過（不再 merge 舊 uid 任務）

### 驗證
- `npx tsc --noEmit` → exit 0,clean
- `npm run build` → success
- **用戶驗證**：切換帳號後舊任務不再出現，Console 不再出現 RLS 403 錯誤

### 教訓
- **§26 類別 J 的觸發條件更新**：孤兒偵測不只需要「不在 5 秒寫入窗」，還需要 `ownerUid === currentUid` filter 才能避免跨 uid 任務被誤判
- **§23 同步層確認關鍵**：這次沒修 `personalTaskSync.ts` 而是修 `AppContext.tsx` — 因為 `localOnly` 邏輯在 AppContext 的 subscribeTasksSync callback 內，不是 personalTaskSync

---

## #009 — 點「已完成」狀態 chip 後畫面空白

### 症狀（用戶描述）
- 收集箱有 3 個 `status: "done"` 的任務（資料面存在）
- 點「已完成」狀態 chip → 該 chip 變高亮（表示 `activeFilter.status === "done"` 寫入成功）
- 畫面變成**完全空白**（既不是 EmptyState「把腦中東西倒出來」、也不是 3 個已完成任務）
- 點其他 chip（待辦 2 / 進行中 0）可以正常切換,只有「已完成」這個 chip 出問題

### Root Cause（activeTasks 拆分鏈 + L6.5 折疊區條件互斥）

`AppShell.tsx` 的任務顯示鏈有 3 段互鎖的衍生 state + 2 條獨立渲染路徑,這次 bug 是「兩條路徑都沒走」造成的：

1. **`displayTasks` 拆分(line 212-216)**：
   ```ts
   const displayTasks = explicitlyShowingDone
     ? filteredTasks.filter((t) => t.status === "done")   // ← 只剩 done
     : filteredTasks;
   ```
   `explicitlyShowingDone=true` 時,`displayTasks` 已經只有 done 的 3 個任務。

2. **`activeTasks` / `completedTasks` 拆分(line 218-219,原版)**：
   ```ts
   const activeTasks = displayTasks.filter((t) => t.status !== "done");    // 0 個
   const completedTasks = displayTasks.filter((t) => t.status === "done"); // 3 個
   ```
   `activeTasks` = 0 個,`completedTasks` = 3 個 — 與「真實世界」剛好相反。

3. **兩條渲染路徑**：
   - **主路徑(line 658 `<AnimatePresence>`)**:iterate `activeTasks` → 渲染 0 個 → 視覺上空白
   - **L6.5 折疊區(line 774)**:`{!explicitlyShowingDone && completedTasks.length > 0 && (<details>...)}` → `!explicitlyShowingDone` 為 false → 折疊區**整段跳過**

**結果**：兩條路徑都不渲染 → 視覺完全空白(就只是 background color 露出來)。

### 修法（4 行三元守衛 / 借 activeTasks 渲染 done）

`AppShell.tsx` line 212-219 區塊改為：

```ts
// L6.5:已完成任務一律顯示在底部折疊區,所以 displayTasks 永遠包含全部
// 例外:用戶主動點「已完成」chip 時,只渲染 done — 此時 activeTasks 借用整個 displayTasks
// 避免 activeTasks = 0 + completedTasks 被 L6.5 折疊區跳過(!explicitlyShowingDone 條件)而空白
const displayTasks = explicitlyShowingDone
  ? filteredTasks.filter((t) => t.status === "done")
  : filteredTasks;
const activeTasks = explicitlyShowingDone
  ? displayTasks   // ← 借用整個 displayTasks(全是 done)
  : displayTasks.filter((t) => t.status !== "done");
const completedTasks = explicitlyShowingDone
  ? []   // ← activeTasks 已包含,折疊區不必再 render
  : displayTasks.filter((t) => t.status === "done");
```

關鍵思路:`explicitlyShowingDone=true` 時,「全部 3 個」都是「active」要渲染的物件,所以 `activeTasks` 借用整個 `displayTasks`；`completedTasks` 留空陣列讓 L6.5 折疊區自然跳過(`!explicitlyShowingDone` 條件本來就擋)。

### 驗證（§12）
- `npx tsc --noEmit` → exit 0,clean
- `npm run build` → exit 0,25 routes + middleware 全部 build 成功
- 推 main → Vercel production deployment 觸發
- 用戶在桌面 Chrome 確認:點「已完成」chip → 看到 3 個已完成任務渲染；點「待辦」chip → 回到原本 2 個待辦任務,折疊區在底部恢復

### 教訓（轉化為 §26 修憲候選 — 類別 S）
- **§26 類別 S 候選 — 衍生 state 拆分鏈 + 多重獨立渲染路徑互斥**:
  症狀鐵三角 = (a) 某個 filter 切換後**完全空白** (b) 切回其他 filter 可恢復 (c) 計數 chip 顯示正確數字(資料沒問題)。
  根因模式:多個 `const x = display.filter(...)` 衍生變數,加上多條獨立渲染路徑,某條路徑的條件與某個衍生變數互斥,導致「**所有路徑都跳過**」。
  判定法:當「資料面正確(計數對)但渲染空白」時,grep 該元件所有「獨立渲染路徑」+ 所有「衍生 state 拆分」,列出「哪些路徑用了哪些衍生 state」、「每條路徑的條件」,對照找出交集為空集的情境。
  治本:把衍生 state 拆分邏輯與渲染路徑選擇**集中到單一 hook**(如 `useTaskListDisplay`),統一管理「這個 view 該渲染哪些 tasks + 區分 active/done」。
- **§18 根因表 3 個候選有效**:本 bug 三角定位時,先列 3 個候選(狀態切換 / filter 邏輯 / 渲染路徑),再讓用戶用 AskQuestion 確認「chip 有無變高亮」+「畫面是何種空白」,才一次命中根因(渲染路徑互斥)。**避免在 3 個候選中悶選**。
- **§18c 列表空白快速確診捷徑**:本 bug 表面症狀與「非正式雜事列表空白」極相似(用戶描述「列表空白,但 status=done 的有 3 個」),§18c 規則第一步先問 user 確認 status 過濾鏈,**避免走 sync layer 排查浪費 tool call**。本案例 user 直接附截圖且 status 明顯是「done」,所以走 §18 根因表而非 §18c。
- **不命中既有類別 N**:雖症狀「空白」看起來與 §26 類別 N(嵌套 ternary 修錯層)相似,但**這次不是 ternary 結構問題**,而是 3 個衍生變數的語意設計錯誤 — 不該拆成 `activeTasks` / `completedTasks` 後還要靠 `!explicitlyShowingDone` 條件守衛折疊區,而是該讓變數在「done-only view」下語意重定義。**所以登 §26 類別 S 候選,不入 N**。
- **§17.1 Architect Mirror 揭露**:`displayTasks` / `activeTasks` / `completedTasks` 三變數語意不明,`explicitlyShowingDone` 又疊一層 — 建議下輪抽 `useTaskListDisplay` hook 統一管理。

---

## #010 — 「開始暖身」fixed bottom 按鈕垂直對齊偏低

### 症狀（用戶描述）
- 桌機（在 Vibe Coding 收件匣視圖）底部中央「開始暖身」按鈕垂直對齊偏低
- icon 跟文字都偏下半部，上方留白明顯比下方大
- New ChipCold Start branch 走 mobile 版（sm:hidden）的按鈕也同樣偏低
- 跟之前 L121 同一個 bug 不同位置同症狀（屬於暖暖身儀式按鈕群）

### 處理過程審計（這次最大浪費 = bug 本體之外）

**累計 3 次 commit 都沒修對**（commit `2842cf1` → `48fbb33` → `a857ffa`），**真正的 root cause 早在第 1 輪**：
1. **第 1 輪**：看到 icon 偏低 → 馬上加 `leading-none` 給 `<span>`，但**這個 span 裡根本還沒包文字**（原文是 bare text `"開始暖身"`），結果**沒生效**
2. **第 2 輪**：發現 bare text 沒包 → 補 span + leading-none → 推後仍未生效；**沒意識到 L121 已經有 `leading-none` 了，所以這個處置本來就對齊了**，我重複處理
3. **第 3 輪**：變更 `gap-2` → `gap-2.5` → 推 → 仍未生效；**runtime 沒變**（gap 只影響 horizontal spacing，不影響 vertical 對齊基準）
4. **第 4 輪前**：用戶說「還沒修好」 — **這個時候就該走 §16 第二次失敗問診**（§16b），但我**繼續進 §10 評分表 6 個方案**，全部 < 9.0 分，浪費 1 輪
5. **第 5 輪**：評分表小動作 + runtime tool call 浪費 1 次（browser_navigate 失敗）+ 強求解釋（dev server 沒跑根本沒辦法量 computed style）
6. **第 6 輪**：用戶主動提供 runtime 證據（Chrome DevTools `getComputedStyle` 輸出）→ **1 輪就命中**真根因

**真根因**(runtime 證據，commit `a857ffa` 評分 9.3)：
```
btn: { h: 22, paddingTop: "8px", paddingBottom: "0px", display: "flex", alignItems: "center" }
flame: { h: 14, top: 8, bottom: 0, verticalAlign: "middle" }
span: { h: 12, top: 9, bottom: 1, lineHeight: "12px" }
```
- `paddingBottom: 0px` 不是 `py-2` 的 `8px` → **inline style 覆蓋了 Tailwind className 的 padding-bottom**
- 根因：L265 的 `style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}` 是 **inline style**（CSS specificity 永遠 > className），且桌面環境 `env(safe-area-inset-bottom, 0px)` 永遠回傳 0 → 把 `py-2` 對稱 padding 改成單邊 0 → button 高度只剩 22px → icon/文字被擠到底部 → `items-center` 對齊基準隨之下移

### 修法
- 移除 L265 inline style，讓 `py-2` 對稱 padding 完整生效
- 桌面 + iOS mobile 都能用（mobile safe-area 處理不在本 PR 範圍，已揭露為 architect mirror，後續統一修）

**驗證（§12）**：
- `npx tsc --noEmit` → exit 0, clean
- 推 main → Vercel production deployment 觸發

### 教訓（轉化成 §26 修憲候選 + §16 強化）

**§26 類別 T 候選 — **inline style 覆蓋 Tailwind className 造成對齊特例**：

症狀鐵三角：(a) 視覺對齊偏移（偏低 / 偏高 / 變形）(b) build/tsc clean (c) 程式碼 review 看起來「className 寫得很對」。

根因模式：某個 `style={{ ... }}` inline style（如 `paddingBottom`、`marginTop`、`width`）覆蓋了 className 設定的對應屬性。**CSS specificity：inline style > className > theme**，所以 `py-2`（設定 `padding: 8px 16px`）會被 `style={{ paddingBottom: '0px' }}` 覆蓋。

判定法（動手前）：
- grep 該元件 JSX 中所有 `style={{ ... }}` prop
- 對每個 inline style 屬性，**對照 className 看是否有相同或相關屬性被設定**（如 `padding` vs `py-2`、`width` vs `w-12`)
- 確認 inline style 是「補上」而非「覆蓋」(應該用 `paddingBottom: calc(...)` 加上去，不該寫成 `paddingBottom: '0px'` 覆蓋原值)

治本：用 CSS variable 累加（`paddingBottom: calc(theme(spacing.2) + env(safe-area-inset-bottom))`）或 Tailwind arbitrary class `pb-[calc(theme(spacing.2)+env(safe-area-inset-bottom))]`。**禁止用 inline style 寫成 tailwind 已定義的屬性**。

**§16 強化 — 同一個 bug 第二次失敗後必停下問診**：

本 bug 嚴格反映了 §16b 的精神，但**實踐中我又踏進同樣的陷阱**：
- 第 1 次失敗後（`48fbb33` 仍偏低）→ 應該走 §16b 第一次失敗即停問診
- 我沒有 → 繼續進 §10 評分表，再失敗後才主動揭露浪費
- §16b 規則在紙面上對，但**實踐中我常「下意識就進評分表」** — 因為評分表是程式性動作，比「停下問用戶」更省努力

**新增觸發**：同一個 bug 第二次失敗後，**唯一允許的 3 個選項**：
- A. 升級 runtime 量化（請用戶提供 DevTools computed style 輸出）
- B. 請用戶執行具體動作驗證（截圖、console log、DevTools 數據）
- C. 用戶已明確指定方案

**禁止**第三次進 §10 評分表嘗試猜 root cause（已有 2 個 sample 失敗證明「猜測」對此 bug 失效率 100%）。

**§15.6 runtime 預算強化 — 請求 runtime 證據前必先驗證前置條件**：

本輪 runtime tool call 浪費 1 次：`browser_navigate` 失敗（dev server 沒開）。**這不是工具問題，是前置條件沒驗證**。

**新增規則**：runtime tool call 前必先確認 (1) dev server 跑 (2) production URL 已知 (3) 用戶同意升級。三者缺一 → 不升級 runtime，改請求用戶提供證據。

### 修憲同步
- `global.mdc`生效紀錄新增 2 條：
  - 2026-07-29 新增 §26 類別 T（inline style 覆蓋 Tailwind className 對齊特例）— 對應本輪 `a857ffa` 修了 3 次才命中
  - 2026-07-29 新增 §16 強化 + §15.6 強化（第二次失敗後唯一 3 個選項 + runtime 前置條件驗證）— 對應本輪 3 次悶改浪費
- 修憲自評：§26-T: **9.3** / §16 強化: **9.2** / §15.6 強化: **9.0**（均首輪即達標，免二輪）

---

## #011 — 禪模式「跳過」按鈕按了沒反應（區間任務 startDate 跟 dueDate 撕開）

### 症狀（用戶描述）
- 在禪模式（Zen mode）有 1 個焦點任務 ttt（id: 1785315789572-0dq8caz）
- 按下「跳過」按鈕 → UI 完全沒變化（沒切到下一個任務、沒動畫、沒 toast）
- console 完全沒任何新訊息（hover 有亮、click 無 log）
- 「完成」按鈕能正常運作（切換到下一個焦點）
- 桌機手機都試過 → 都有問題

### Root Cause（區間任務 escape 邏輯撕開 startDate 跟 dueDate）

`src/lib/AppContext.tsx` line 1001-1010（修前）的 `escapeTask`：

```tsx
const escapeTask = useCallback((id: string) => {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (task.startDate) {
    // 區間任務:只推進 startDate
    const tomorrow = toLocalDateString(new Date(Date.now() + 86400000));
    updateTask(id, { startDate: tomorrow });
  } else {
    updateTask(id, { dueDate: undefined });
  }
}, [tasks, updateTask]);
```

`src/components/ZenDashboard.tsx` line 56-65 的 `selectZenTasks`：

```tsx
function selectZenTasks(tasks: Task[]): Task[] {
  const today = new Date().toLocaleDateString("en-CA");
  return tasks.filter(
    (t) =>
      !t.isArchived &&
      t.status === "todo" &&
      !t.parentId &&
      t.dueDate === today,   // ← 只看 dueDate,不看 startDate
  );
}
```

**撕開的數據鏈**（用戶跑 runtime 驗證確認）：
```
ttt (id 1785315789572-0dq8caz)
  taskType: undefined
  startDate: 2026-07-30  ← 已推進(區間任務 escape 後)
  dueDate: 2026-07-29    ← 沒動(還是今天)
  status: todo, isArchived: false
```

按「跳過」→ `escapeTask` 走 `if (task.startDate)` 分支 → 只更新 `startDate: 2026-07-30` → `selectZenTasks` 仍命中（`dueDate === today` 還成立）→ ttt 還在 visibleTasks[0] → UI 焦點沒變化。

### 修法（commit `b54ce30`）

A+ 雙保險方案：

| 改動 | 檔案 | 邏輯 |
|---|---|---|
| 1. escapeTask 區間任務同步推進 startDate 跟 dueDate | `src/lib/AppContext.tsx` | `startDate` 分支內新增 `const newDue = task.dueDate ? toLocalDateString(new Date(new Date(task.dueDate).getTime() + 86400000)) : undefined;` 然後 `updateTask(id, { startDate: newStart, dueDate: newDue })` |
| 2. selectZenTasks 加 `!(t.startDate && t.startDate > today)` 雙保險 | `src/components/ZenDashboard.tsx` | filter 多加一行：`!(t.startDate && t.startDate > today) && t.dueDate === today` |

**治本**：escape 邏輯改對後,startDate 跟 dueDate 同步推進 → selectZenTasks `dueDate===today` 變 false → ttt 從焦點消失 → UI 跳到下一個焦點任務。

**治標雙保險**：即便有別的入口繞過 escape 直接改 startDate（批次搬移、UI 拖日期等）,filter 也守得住未來日期的區間任務不會誤判為今天的焦點。

### 驗證（§12）
- `npx tsc --noEmit` → exit 0, clean
- `npm run build` → exit 0, 25 routes + middleware 全部 build 成功
- 推 main → commit `b54ce30` → Vercel production deployment 觸發
- 用戶確認:之前已撕開的舊資料(2026-07-29 / 2026-07-30)用 localStorage 手動同步推進後 → 區間任務按「跳過」正常切換到下一個焦點

---

## ⚠️ 處理過程審計：這次是「修憲」最大觸發來源

**這次 bug fix 期間總共 57 個 assistant 訊息 / 12 個 user 訊息 = 4.75 倍輸出/輸入比**（健康基準 ≤2.5 倍）。中間浪費的關鍵回合逐一記錄：

### 浪費點 1：turn 1（19:44）一次列 6 個根因不確認
第一輪列了 6 個「沒反應的可能根因」(`handler 沒綁定 / handler 拋錯 / 沒有下一個任務可跳 / state 沒更新 / Zustand selector 訂閱失效 / modal/sheet 擋住 click`) 但**沒有用 AskQuestion 三角定位**就直接進悶查。**§18 違規**。

### 浪費點 2：turn 2-5（19:46 → 20:01）15 分鐘悶進「click 沒打到 button」假設
連續 4 輪查「是不是某個 invisible 元素覆蓋跳過按鈕」（GhostButton / FeedbackButton / WarmupSection / FlowTimer / globals.css / FocusCard）— **整個方向從根上就是錯的**：click event 確實有打到按鈕、`escapeTask` 確實有執行、`updateTask` 確實有更新 React state，但視覺沒變因為 selectZenTasks 條件沒命中。**應該走 §18b「操作失敗初始確認」問用戶「你按的是哪個按鈕？」**（已完成規則,但這次沒走）。

### 浪費點 3：turn 7（21:38）抽錯 storage key 名
我請用戶跑 `localStorage.getItem('personal_tasks')` — **這個 key 名是我猜的,沒 grep 確認**。回傳 undefined 後又花 5 輪（turn 47-56）才查到正確 key 是 `taskflow_tasks`。**§14 違規**：動手前沒 grep 確認 storage key 命名。

### 浪費點 4：turn 19-42（21:42-21:42）「等等！我突然意識到」型假進度 ≥ 10 次
`grep -c "等等"` 在 assistant 訊息裡出現 ≥ 10 次（line 19、20、21、22、30、31、35、37、38、39、41、42、46）。每次都宣稱「重大發現」但其實多數沒附新的 runtime 證據,**純粹製造假進度感**。

### 浪費點 5：turn 23（assistant line 23）「做了 13 輪靜態分析沒命中還繼續」
應該走 §16b「第一次失敗即停問診」但**繼續列評分表 + 派 elementFromPoint 檢測腳本**給用戶跑。雖然最終幫忙定位「按鈕 27×20 太小」誤導方向,但其實是錯方向。

### 浪費點 6：turn 35-42 反覆推理「React handler 有跑啊為什麼 UI 沒變」
我說「React 17+ 委派在同一個原生事件上」→ 「所以 React onClick 一定會被觸發」。這個結論**對了一半**：click 確實會觸發,但這不代表「視覺有變化」。我**誤把「React handler 被觸發」當成「視覺會變化」的同義詞**。

### 浪費點 7：turn 41 → turn 43-58 同一個結論重複驗證
turn 41 我推論「區間任務 escape 後還出現在 today 焦點區」,**沒做任何 runtime 驗證就宣稱找到了 root cause**。turn 43 我又請用戶跑更複雜的 script 重新驗證同一件事 — **這是 §10.2 / §10.4a 違規**：已推理過的結論分數被悄悄降級後重出驗證流程。

### 教訓（轉化成 §14.4 + §16b.1 + §18d.1 三條修憲）

#### §14.4（runtime 檢測前必先 grep 確認所有變數名）
對應浪費點 3：寫 `localStorage.getItem('personal_tasks')` 應該先 `grep "localStorage.getItem"` 確認實際 key 名,直接 grep 就 1 輪解決,不用浪費 5 輪查正確 key 名（50K+ tokens）。

#### §16b.1（AI 自我悶頭 3 輪無新進展也停下）
對應浪費點 1、2、5：§16b 原本只在「用戶主動報告失敗」時觸發,但實務中 AI 自己悶頭推理 5-10 輪沒命中根因時也該停下。新條文設定「3 輪無實質新進展」判定標準（沒新 runtime 證據 / 重複同方向 / 「等等！」≥3 次沒附證據 / 結論互相矛盾）→ 第 3 輪立即停下 + 報告 + 走 AskQuestion。

#### §18d.1（焦慮語言禁令）
對應浪費點 4：debug 過程中禁止「等等！我突然意識到 / 等等！等等！等等！ / 關鍵發現！」等無 runtime 證據的假進度開場白,唯一豁免是用戶已附 runtime 證據（console / 截圖 / DevTools 數據）。debug 結束後事後回顧時不受限（commit message 或 bug 案例回顧可以用「關鍵發現」）。

**三條互補觸發**：§18d.1（語言層） + §14.4（變數名層） + §16b.1（悶頭推理層） — 涵蓋本次浪費的 3 個核心維度。

### 修憲同步
- `global.mdc` 生效紀錄新增 1 條（2026-07-29）：
  - 新增 §14.4 + §16b.1 + §18d.1 — 對應本對話浪費點 1-7
- 修憲自評：**§14.4: 9.1 / §16b.1: 9.0 / §18d.1: 9.1**（均首輪即達標,免二輪）

---

## #012 — 完整 push 鏈條：10 個 commit 才打通「按重新訂閱沒反應 → tag 去重不彈 banner」

### 症狀（用戶描述，跨多輪對話累積）

這是個**症狀群**，不是單一 bug — 但根因都在同一條 push 鏈條上，所以歸成單一案例：

| 階段 | 用戶描述的症狀 |
|---|---|
| A. 訂閱按鈕沒反應 | 點「訂閱」按鈕 → 沒任何 console log、沒 toast、沒視覺變化；console 完全無訊息 |
| B. 訂閱永久卡住 | 點「重新訂閱」 → 看起來進行動畫 → 12 秒後 timeout 失敗；重整後再點 → 還是卡住 |
| C. 拒絕狀態無解 | 一旦點過「拒絕」 → 沒有 UI 提示如何重新授權；Chrome 不會再問第二次 |
| D. SW 卡死 | 解除訂閱後再訂閱 → 沒有新 SW 註冊；舊 endpoint 還在後端 |
| E. 強制重置後 SW 不重註冊 | 按「強制重置推播」按鈕 → unregister SW 後新 SW 沒自動註冊 |
| F. 通知按鈕沒圖示 | 推播抵達 SW → `showNotification` 時 Chrome 報 favicon 404 → 整個 push event 處理中斷 |
| G. middleware 攔 sw.js | Next.js middleware matcher 把 sw.js 跟 manifest.json 也包進去 → 這些檔被導到 API 路由 404 |
| H. subscribe API RLS 缺欄 | `POST /rest/v1/push_subscriptions` 報 400 — 因為 `id` 欄位沒帶但 schema 是 `primary key` |
| I. notificationPermission state 不同步 | 重置按鈕清後端 + 清前端訂閱，但 `Notification.permission` 還停在 "denied" 沒 reset |
| J. 測試推播第二次不彈 banner | 重置後第一次按測試推播 ✅ banner 出來；第二次以後按 → 完全沒 banner（連 console 都沒訊息） |

### Root Cause（10 個獨立根因，但都在同一條 push 鏈條）

| Commit | 命中根因 |
|---|---|
| `a0386d3` | `/api/push/subscribe` 用 `createServerClient` 取代直接呼叫 Supabase，cookie auth 才有 user.uid |
| `9351f53` | subscribe / unsubscribe handler 加 12 秒 timeout — 防止 RLS 400 死等無限 |
| `49e4663` | SettingsPage 加「強制重置推播」按鈕，呼叫 `unsubscribe()` + 刪後端 + `unregister()` SW |
| `c0d9e30` | 訂閱失敗 toast 拆三種原因（timeout / not allowed / RLS），debug 視覺化 |
| `45c5234` | "已拒絕" 狀態顯示 iOS 解鎖路徑（設定→Safari→進階→網站資料） |
| `701aa97` | 強制重置後同步 reset 前端 `Notification.permission` state（前端 useState 也要清） |
| `0cfbc1e` | 強制重置後立刻重新註冊 SW（`navigator.serviceWorker.register` 不等於 SW 已就緒） |
| `6ac489e` | Next.js middleware matcher 排除 sw.js + manifest.json，避免被導到 API 404 |
| `2465f5b` | 新增 `public/favicon.svg` — SW `showNotification` icon 必填，404 會讓 push event handler throw |
| `dce7178` | subscribe API payload 補上 `id` 欄位（`crypto.randomUUID()`），schema `primary key` 必須有值 |
| `e076783` | `/api/push/test-self` 帶 `task_id: \`test-${Date.now()}\``，避免 `sendPush` fallback 到固定 tag `"taskflow-notification"` 被瀏覽器視為同通知更新 |

### 處理過程審計（這次是「失序累積」型 bug 案例）

**這個 bug 案例跟 #010 / #011 不同**：#010 / #011 是「**同一個 root cause 修了 3 次才命中**」，但 #012 是「**10 個獨立 root cause 各自修一次，每個都命中真根因**」。換言之，每個 commit 的修法本身都正確，**但沒有任何一個 commit 一開始就看清整條鏈條**。

**累計 10 個 commit、跨越約 5 輪對話（從 commit `a0386d3` 起到 commit `e076783`）**，每輪對話只看到當下症狀的 root cause，沒人（包含用戶跟我）一開始就知道「這個症狀背後有 10 層獨立的問題」。

### 各階段的失序類型（**這才是 #012 真正值得記錄的價值**）

| 階段 | 失序類型 | § 違規 |
|---|---|---|
| A. 訂閱按鈕沒反應 | 第一輪列了 6 個可能根因（後端 / SW / Chrome 靜默通知 / macOS Focus / 設備錯置），沒走 §18d 重述先問「console 有 log 嗎？」 | §18d |
| B. 訂閱永久卡住 | 沒第一時間就抓到「RLS 拒絕 = 12 秒死等」，靠 user 提供 console 才定位 | §18b + §27 |
| C. 拒絕狀態無解 | 沒主動揭露「notification permission 拒絕後怎麼解」— UI 上完全沒引導，靠用戶自己找到 | §7 防禦性 UI |
| D. SW 卡死 | 「強制重置」按鈕第一步呼叫 `unregister()`，但**沒主動 `register()` 新 SW** — user 必須 hard reload 才能拿到新 SW | §13（沒考慮 SW lifecycle） |
| E. 強制重置後 SW 不重註冊 | 重置流程沒包含「呼叫 `navigator.serviceWorker.register()` 重新註冊」，靠 commit `0cfbc1e` 才補上 | §14 實作前完整讀取（沒讀 SW lifecycle 文件） |
| F. 通知按鈕沒圖示 | SW `showNotification({ icon: '/favicon.svg' })` 寫死 favicon.svg 路徑，但 `public/favicon.svg` 不存在 → fetch 404 → SW push handler throw | §6 語意化 HTML / §14（沒 grep 確認檔案存在） |
| G. middleware 攔 sw.js | Next.js middleware matcher 把所有 `/api/*` 以外的檔案都包進去 — 包含 `/sw.js`、`/manifest.json`，被導到 404 | §23 同步層確認（同源精神：路徑配置不熟） |
| H. subscribe API RLS 缺欄 | payload 構造沒對照 schema — `id` 欄位是 primary key 但 subscribe API 沒帶 | §14（沒讀 schema） |
| I. notificationPermission state 不同步 | 前端 useState `permission` 沒在重置時一併 reset，靠 commit `701aa97` 才補 | §25 既有防護對齊（沒 grep 同檔所有 permission 引用點） |
| J. tag 去重（最後一塊） | 前 5 輪悶頭猜（後端 / SW / Chrome / macOS / 設備），沒問用戶「按幾次有幾次 banner？」這個時序問題 | §18d + §27.1 |

### 教訓（轉化成 §26 修憲候選 — 類別 U 候選）

**§26 類別 U 候選 — 多層獨立根因鏈條 bug**：

| 項目 | 內容 |
|---|---|
| 症狀鐵三角 | (a) 一個症狀反覆修都修不好 (b) 每次修都「修對了一塊」但「還有別塊沒修」(c) 累計多個 commit 各自命中不同層次 |
| **根因模式** | 一個症狀背後其實是多個獨立 root cause **疊加** — 修了一塊症狀消失，但下一塊症狀浮現。每個 root cause 各自需要單獨的修法，沒有「一次修好」的可能。 |
| **典型場景** | 任何跨多層的鏈條（push notification、OAuth、第三方 API 串接、WebRTC 等），每個層都可能有自己的 bug |
| **判定法** | 累計 3 個 commit 修同一症狀群 → 必走 §27「失敗 2 次後評分表必含重構大改」；**新增**：累計 5 個 commit 修同一症狀群 → 必須停下做 **「整條鏈條的 root cause map」**，禁止繼續「一次修一塊」 |
| **治本** | (1) 第一次接觸鏈條型功能時，先畫完整鏈條圖（前端 → SW → 後端 → 第三方服務），列出每一層可能失敗的所有點 (2) 每次只修「症狀對應的那一層」，不要假設這是「唯一 root cause」 (3) 連續 3 個 commit 後必停下，先**輸出 root cause map**給用戶對齊 |

### 修憲同步
- `global.mdc` 生效紀錄新增 1 條（2026-08-02）：
  - 新增 §26 類別 U（多層獨立根因鏈條 bug）— 對應本對話 10 個 commit 才打通整條 push 鏈條的具體根因
  - 同步新增 §27.1 強化：累計 3 個 commit 修同一症狀群 → 必停下做「整條鏈條的 root cause map」
- 修憲自評：**§26-U: 9.0 / §27.1 強化: 8.8**（§26-U 首輪達標門檻；§27.1 強化 <9.0 由用戶確認是否推進）

---

## #014-r6 — 真正 root cause: PullToRefresh 用 window.scrollY 判斷頂部 → 內層 scroll container 永遠誤觸發並鎖死 touch

### 症狀（用戶描述）
- 環境：iOS PWA（主畫 icon）
- 清單內有大量任務（Vibe Coding 有 99 個已完成任務）
- 滑到底部後「硬往上拖」,手指物理方向向下 → 期望向上滑回頂部,**結果頁面整體往下 rubber band,內層任務列表完全沒有任何滾動反應**
- 用戶截圖顯示:底部導航上方有明顯 rubber band 視覺,但任務列表本身沒在動

### 處理過程審計(這次是「**5 輪全部猜錯**」型 bug 案例)

| 輪 | 我的診斷 | 為何錯 | commit |
|---|---|---|---|
| r2 | AppShell L489 外層 `overflow-hidden` 跟 L493 內層 `overflow-y-auto` 衝突(雙 scroll container) | 方向對(類別 B),但只看到表層 | `531ea5e` |
| r3 | PullToRefresh `touchAction: "pan-down"` 禁止向上 pan | 局部有效,症狀從「卡住」變「過度滾動」 | `0f29168` |
| r4 | dnd-kit PointerSensor 在 iOS Safari 搶走 touch event | 局部有效,症狀從「都不 ok」變「中間 ok、底部不 ok」 | `1e39058` |
| r5(治標) | 手機版 disable sortable | 把 sort context 整個拔掉,清單能滑但仍卡底部 | `4c3cc41` |
| r6(我) | iOS PWA 內外層 overscroll 傳遞,加 `overscroll-behavior: contain` | **假修復**:用戶硬往上拖仍卡死,證明 contain 沒生效,我連診斷都是錯的 | `b309908` |
| **r6(另一位 IDE)** | PullToRefresh 用 `window.scrollY === 0` 判斷頂部,但內層 scroll container 環境下永遠 = 0 → 內層滑到底後「想向上滑」(手指物理向下) → PullToRefresh 誤觸發並鎖 touch event,內層 scroll 收不到滾動事件 | **真根因,1 輪命中** | (另一位 IDE 推 main) |

### 為何我 5 輪都沒命中(自我檢討)

**根因 1 — 我沒抓「內外層 scroll 容器分離」這個事實**

- 整個對話中我一直假設「整頁是一個 scroll」,從沒認真 grep `overflow-y-auto` 的位置 + 確認 scroll 容器到底是誰
- 我看到 PullToRefresh 有 touch handler,看到 AppShell 有 overflow-y-auto,看到 dnd-kit 有 sensor,**但我從沒做過這一件事**:grep `PullToRefresh` 的 onTouchStart 觸發條件 + 內層 scroll container 的 scrollTop 關係
- 真正讀 PullToRefresh L26 一行程式碼 `if (window.scrollY <= 0)`,就會發現:**這個檢查在內層 scroll 環境下永遠成立**,根本是「裸眼可見」的 bug
- **為何我沒讀到**:每輪我都從「症狀表面 → 推測抽象根因」,從沒把 PullToRefresh 的 L26 跟 L38-40 的 preventDefault 邏輯、跟 AppShell 的 overflow-y-auto、跟「用戶在底部想向上滑」的物理動作,**串起來看**

**根因 2 — 我把 PullToRefresh 當「副作用元件」,沒當「主導元件」**

- 我把它視為「裝飾性功能,可能干擾 scroll」,所以一直從「如何讓它不干擾」方向修(touchAction 改 pan-y、disable sortable、加 overscroll-behavior contain)
- **從沒想過「它是 root cause」,因為它「只是個元件」,邏輯看起來「只是偵測下拉」**
- 但事實上,**PullToRefresh 的 onTouchStart + onTouchMove 邏輯本身就是**:`if (window.scrollY <= 0) → setPulling(true) → 攔 touch event → setPullDistance → translateY(整個畫面) → 鎖死 scroll`。這個 chain 在內層 scroll 環境下是「**永遠在主動搶 touch**」
- 我對「PullToRefresh 是問題元件」的懷疑不夠深

**根因 3 — 「修法有效 = 根因正確」的假設**

- r3 修 touchAction 後「卡住」變「過度滾動」,我把它當「修對了一半,繼續往深層挖」
- 但其實「症狀從 A 變 B」**不能證明根因是對的** — 它只證明「這層確實有影響」
- 真根因(PullToRefresh L26 用 window.scrollY 判頂部)從 r2 開始就**一直存在**,我每一輪都在「症狀表層變化」打轉,**從來沒有回到 r2 重新質疑根因**

**根因 4 — 沒有 runtime 證據就敢 commit**

- r2/r3/r4 我都有 grep + 程式碼 review,但**沒有用 runtime 工具確認**「PullToRefresh 的 onTouchStart 在用戶硬往上拖時到底有沒有 setPulling(true)」
- 如果當時有 runtime 證據(例如 console.log pulling state),**1 輪就會發現 PullToRefresh 的 onTouchStart 在用戶於底部「想向上滑」時被觸發**,立刻定位到 L26 的 window.scrollY 條件
- §28 runtime 預設禁用讓我「不主動跑 runtime」,但 §27 + §16b 應該讓我「第 3 輪失敗就停下要求用戶提供證據」,**我卻一直停在 §10 評分表裡猜下一個根因**

**根因 5 — 沒列「所有可能根因表」就動手**

- 5 輪每次都是「先 commit 修法 → 用戶回『沒修好』→ 再修」
- §18 第 2 步要求「至少列 3 個可能根因」,**但 5 輪每次都只有 1 個猜測就動手**
- 如果 r2 第一輪就列 3 個根因:(a) 雙 scroll container 衝突(我的猜) (b) PullToRefresh 內部邏輯誤觸發 (c) dnd-kit 搶 touch,**三個都檢查,1 輪就可能命中 (b)**

### 修法（另一位 IDE 一次性命中）

```typescript
// Before (有 bug):用 window scroll 判頂部
const handleTouchStart = useCallback((e: React.TouchEvent) => {
  if (window.scrollY <= 0) {            // ← 內層 scroll 永遠 = 0,永遠觸發
    touchStartY.current = e.touches[0].clientY;
    setPulling(true);
  }
}, []);

// After (正確):用內部 scroll container scrollTop 判頂部
const handleTouchStart = useCallback((e: React.TouchEvent) => {
  if (containerRef.current && containerRef.current.scrollTop <= 0) {  // ← 真實頂部
    touchStartY.current = e.touches[0].clientY;
    setPulling(true);
  }
}, []);
```

+ `touchAction: "pan-y"` 雙向放手(保留 r3 修正)
+ 保留 r6 的 `overscroll-behavior: contain`(獨立正確,iOS PWA 環境仍需要)

### 教訓(轉化成 §26 修憲候選 — 類別 R「scroll lock hijack by touch gesture with wrong container reference」)

**新增條文** (§26 類別 R,完整條文見 `global.mdc`):

> **R** | **Scroll Lock Hijack by Touch Gesture with Wrong Container Reference** | Pull-to-Refresh / swipe-to-dismiss / pull-to-load-more 等「方向性 touch 手勢元件」用 `window.scrollY === 0` 判斷頂部,但任務列表 / 卡片堆疊是在**內層 scroll container**內滾動 → `window.scrollY` 永遠 = 0 → 當用戶在內層容器「想向上滑」(手指物理方向向下)時,元件誤觸發並 setPulling(true) + 攔 touch event + translateY(整個畫面),內層 scroll 收不到滾動事件,看起來像「卡死」 | **(1) 方向性 touch 手勢元件 必須用內部 ref 的 `scrollTop === 0` 判頂部,不是 `window.scrollY`** (2) `touchAction: "pan-y"` 雙向放手,不要 "pan-down" (3) `overscroll-behavior: contain` 阻斷外層 overscroll(獨立生效,即使 (1) (2) 都修了仍需要) (4) **首次接觸方向性 touch 手勢元件時,必先 grep 觸發條件用 `window.scrollY` 還是 `scrollTop`**

### 為何這次必須修憲(而不只是登記 bug)

- 我自己 5 輪都沒命中 → 證明「方向性 touch 手勢 + 內外層 scroll」這個 combo 是**人類直覺盲區**(看似簡單的條件,實際是複雜的語意錯誤)
- 未來任何 PWA/行動版元件(下拉選單、swipe-to-delete、sticky header 隱藏等)都可能踩同一個坑
- 不修憲 → 下次 #015 又是 5 輪

### 修憲同步
- `global.mdc` §26 新增 1 個類別:**R**(scroll lock hijack by touch gesture with wrong container reference)
- `global.mdc` 生效紀錄新增 1 條(2026-08-02):
  - **新增 §26 類別 R** — 對應 #014 真 root cause 5 輪都沒命中、直到另一位 IDE 一次命中的具體教訓
  - **同步強化 §27**:bug fix 5 輪全失敗 → 必停下做「**完整元件行為表 + touch event 路由圖**」,禁止「一次猜一個根因」
  - **同步強化 §18 第 2 步**:列可能根因表時,必須包含「**所有方向性 touch 手勢元件的內部邏輯**」(PullToRefresh / SwipeableRow / swipe-to-dismiss 等)
- 修憲自評:**§26-R: 9.2**(首輪達標)/ **§27 強化: 8.8**(誠實揭露,需用戶確認是否推進)

---

## #015 — 禪模式「下一個輪值」按鈕按了沒反應

### 症狀（用戶描述）
- 禪模式中央焦點卡片(commit 74d7a7e 新增的「下一個輪值」按鈕)點下去
- 沒有任務切換、沒有 motion animation、沒有任何視覺變化
- 預期:下一個 today 任務升為焦點、原焦點退到下一順位

### Root Cause(雙層耦合 bug)
- **A 層(單一根因)**:`selectZenTasks` 是純 `tasks.filter(...)`,**沒有 sort by `order` 欄位**
  - `Task` type 有 `order: number` 欄位(`src/lib/types.ts:160`)
  - `reorderTasks` 內部正確寫入 `order: idx`(`src/lib/AppContext.tsx:1357`)
  - 但 `selectZenTasks` 從來沒讀過 `order`,直接用 `filter` 後的陣列物理順序
- **B 層(`reorderTasks` 設計,屬背景)**:`reorderTasks` 內部用 `tasks.map((t) => ids.has(t.id) ? updated.find(...) : t)` 保留原 tasks 陣列物理位置
  - 也就是說 `reorderTasks` 正確重編 `order` 欄位,但**不會重排 React state tasks 陣列**
  - 如果沒有人在消費 `order` 欄位,這個 helper 看似寫了但沒生效

### 為什麼 commit 74d7a7e 沒抓到
- 當時只 grep 了 `reorderTasks` 內部邏輯、用 `arrayMove` 模式手寫 reorder — 但**沒意識到 `reorderTasks` 是「重編 `order` 欄位」而非「重排物理位置」**
- 同時**沒對齊 `selectZenTasks` 是否讀 `order`** 這個最關鍵的 contract
- 屬於 §14 違規:動手前只對該檔案 grep,但**沒對齊「誰是這個欄位的真理來源」**—— 假設 `order` 欄位 = 可見順序,沒驗證
- §30 強化教訓:本次 commit 也沒做「點按 button 後 focus 真的切換」的 sanity check(§18 runtime 預算 0 上限 → 改用戶視覺驗收)

### 為什麼「拖曳也一樣不生效」(先前既有 bug)
- `handleDragEnd` 跟新按鈕走同一條 `reorderTasks` 路徑
- 因此禪模式內用 dnd-kit 拖曳 UPCOMING 排序的視覺反應,**也早就失效**了
- 使用者沒報 → 可能是因為拖曳成功後 reload 才知道順序沒變(禪模式自動 reload 焦點不會重新計算)
- 這條 bug 跟新按鈕同根因,本 fix 同時也讓拖曳生效

### 修法
- `selectZenTasks` 在 `.filter(...)` 後加上 `.sort((a, b) => a.order - b.order)`
- 一行改動,讓 `order` 欄位真正決定可見順序
- 不動 `reorderTasks` 內部物理位置邏輯(其他 view 如任務大廳是用物理位置,未報 bug 前不動)

### 教訓(轉化成 §26 修憲候選 — 類別 V「Selector 對 SSOT 欄位無感」)

**新增條文** (§26 類別 V,建議補進 `global.mdc`):

> **V** | **Selector 對 SSOT 欄位無感** | `selectXxx` 從某個 array 過濾出來的元素,**未依 SSOT 排序欄位** sort,導致 sorting helper(reorderTasks / reorderLists / sortByField)寫入新 order 後,這個 selector 仍按 array 物理位置回傳,呼叫端拿到舊順序、永遠看不到新的 | (1) **寫 selectXxx / filter tasks 時必先 grep 同檔是否有同源 sort helper,確認欄位是否真的被當作 SSOT 讀** (2) `tasks.filter(...)` 結束後 + `.sort((a,b) => a.order - b.order)` 是大多數 list-style selector 的最小正確合約 (3) **commit 前 `Grep` 該檔所有 `selectXxx` 呼叫端,確認每個呼叫端都期望「排序結果」而不是「物理位置」** — 如果只一個需要 sort,就把 sort 提到 selector 內部;如果都不要 sort,就要明白記載「物理位置 = SSOT」

### 為何這次必須修憲
- 跟 §26 類別 E(修錯層)同類,但 V 更精準地描述「selector 對 SSOT 欄位無感」這個**特定失敗模式**
- 未來任何 `selectXxx` (selectZenTasks / selectTodayTasks / selectUpcomingTasks / selectSharedTasks) 都可能踩這坑
- 不修憲 → 下一個 `selectXxx` 又會用同樣方式 fail

### 修憲同步
- 建議 `global.mdc` §26 新增 1 個類別:**V**(selector 對 SSOT 欄位無感)
- `global.mdc` 生效紀錄新增 1 條(2026-08-03)
- 修憲自評:**9.0**(首輪達標)

