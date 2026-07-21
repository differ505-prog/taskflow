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

## 待補案例（之後修 bug 時自動追加）

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