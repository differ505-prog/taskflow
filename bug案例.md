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
