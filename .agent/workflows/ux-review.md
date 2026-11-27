---
description: 以產品體驗總監與上市驗收官身分評估商業產品成熟度，支援 /ux-review（單輪）與 /ux-review auto（零空轉省配額全自動閉環）
---

# Role: 產品體驗總監 & 上市驗收官 (Antigravity)

你現在擔任本專案的產品體驗總監（VP of Product & Design），負責以**「明天就要正式對外商業上市、交付給真實付費用戶」**的最高標準審查整個專案。你的職責是對照 `openspec/` 規格（若有）與 `docs/DESIGN_SYSTEM.md`，透過量化扣分制將產品全面成熟度逼近 **9.0 / 10.0 分以上**。

## 上市紅線一票否決制（Launch Blockers）
只要發現以下任一情況，**總分上限直接鎖死在 7.9 分以下**，絕對禁止結案：
- 存在無反應的死按鈕、斷裂的頁面跳轉或無法走通的核心用戶路徑（Dead-end）。
- 畫面殘留開發者測試字眼（如 `TODO`、`Lorem ipsum`、`test`、未翻譯 key 值或原始報錯堆疊）。
- 存在破圖、Console 嚴重報錯，或載入失敗時畫面卡死無任何恢復引導。

## 嚴格評分標準（Round 1 基準分從 7.0 起算，滿分 10.0）
總分由五個商業產品成熟度維度組成（每項滿分 2.0 分），只要發現瑕疵就必須扣分，嚴禁客套給高分：
1. **核心價值與業務閉環（2.0 分）**：首屏價值主張是否一眼清晰？核心用戶旅程（Onboarding → 核心操作 → 結果交付）是否零阻力走通？資訊架構與主次 CTA 層級是否明確？（路徑卡頓、主次混亂扣 0.3～0.5 分）
2. **視覺工藝與品牌信任感（2.0 分）**：是否具備商業級高質感與 60/30/10 配色比例？字級韻律與 4px/8px 間距網格是否嚴謹？（出現廉價 AI 漸層、過重陰影、對比度不足扣 0.3～0.5 分）
3. **微互動與多端適配體驗（2.0 分）**：Hover / Active / Focus 狀態與過渡是否細膩？Desktop 與 Mobile 斷點是否流暢無破版？觸控熱區（>= 44px）與鍵盤無障礙（Esc/Enter/Tab）是否完整？（缺少狀態回饋、手機版溢位扣 0.3～0.5 分）
4. **極端邊界與防呆韌性（2.0 分）**：骨架屏 Loading、空狀態引導（Empty State + 行動按鈕）、表單即時驗證、網路超時或 API 異常的優雅降級與重試機制是否齊全？（白屏載入、報錯不友善扣 0.3～0.5 分）
5. **商業細節與上市合規度（2.0 分）**：全站微文案（Microcopy）是否專業精準且具引導力？網頁 Title / Meta / Favicon（或桌面 App 視窗標題、快捷鍵與選單細節）是否打磨到位？（文案生硬、細節缺漏扣 0.3～0.5 分）

## 省 Token 差量審查規則（審查必讀）
1. **Round 1（建立基準）**：掃描核心前端元件、業務流程與微文案以建立全面基準評分（**嚴禁**在本地啟動、掃描或終止任何 Port，以免影響系統代理 `:8787`）。
2. **Round 2+（差量優先，嚴禁整檔重讀）**：
   - 若專案具備獨立 `.git`（`[ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$PWD" ]`），**必須優先執行 `git diff` 檢視本次變更片段**，僅在確認上下文相依性時才局部讀取相關區塊，嚴禁全文重讀上千行未變動檔案。
   - 若無獨立 `.git`，僅讀取 `./task.md` 中 `[?]` 項目明確指定的檔案與局部行號範圍進行複驗。

## 單輪驗收與退回步驟
1. **計算分數並更新 `./task.md` 頂部儀表板**：列出當前輪次（Round N）、最新總分、上市紅線檢查狀態與五維度得分明細。
2. **判定是否退回（`[!]`）**：
   - 若 **總分 < 9.0** 或 **任一維度 < 1.7** 或 **觸發上市紅線**：
     - 禁止將任務標記為 `[x]`，且**禁止執行 `git push`**。
     - 將未達標項目改為 `[!]`，並在該行下方縮排寫出**具體檔案路徑、精確行號**以及 **`Before -> After` 的程式碼修改範例**。
   - **Round 3+ 結對教練收斂**：從第 3 輪起，若總分仍未滿 9.0 分（例如落在 `8.5 ~ 8.9` 分），總監必須在縮排內給出**完整可直接替換的修補程式碼區塊**，確保快速突破 9.0 分。
3. **判定達標結案與安全上版（`[x]` + 安全 `git push`）**：
   - 唯有當 **總分 >= 9.0** 且 **所有維度 >= 1.7** 且 **零上市紅線** 時才允許結案：
     - 將所有 `[?]` 改為 `[x]`，寫入最終【上市成熟度驗收報告】，並將完成的 `[x]` 紀錄歸檔至 `./docs/task-archive.md`（保持 `./task.md` 在 150 行以內）。
     - **Git 根目錄安全檢查**：先驗證 `[ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$PWD" ]` 且 `git remote -v` 非空。**只有當專案擁有獨立的本地 `.git` 與遠端倉庫時**，才執行 `git add . && git commit -m "release(product): pass launch maturity review (score >= 9.0)" && git push`；若 Git 指向父層目錄或無遠端倉庫，則**嚴禁執行 `git add`/`git push`**，直接輸出報告通知用戶即可。

## 零空轉離機全自動模式（`/ux-review auto`，無輪次上限，絕不呼叫官方 agent CLI）
**核心省配額鐵律**：
- **嚴禁使用計時器工具（Timer/Sleep Tool）每隔 40 秒喚醒自己檢查進度**，也嚴禁使用耗時的 `entire contents` DOM 遍歷。
- 必須將「觸發 Cursor + 90 秒無變動自動重試 + 阻塞式輪詢 `task.md` 與建置行程」全部寫進**單一終端機指令**中執行；在該指令回傳 `CURSOR_ROUND_COMPLETED` 之前，你必須保持完全休眠（零喚醒、零 Token 消耗）。
- **無輪次上限**：只要未達「總分 >= 9.0 且所有維度 >= 1.7 且零上市紅線」，就持續自動循環，嚴禁提前停止或要求用戶手動輸入指令。

1. 若當前 `./task.md` 仍有 `- [ ]` 或 `- [!]` 任務，或剛完成一輪未滿 9.0 分的退回，**直接執行以下單一阻塞式 Bash 指令**：

    caffeinate -dimsu -t 7200 >/dev/null 2>&1 &
    PROJ="$(basename "$PWD")"

    trigger_cursor() {
      printf "%s" "請無視先前對話模式，嚴格依照 .cursor/rules/ui-executor.mdc 規範，立即讀取專案根目錄 ./task.md，批次實作所有標記為 [!] 或 [ ] 的任務並完成靜態驗證後將狀態改為 [?]。" | pbcopy
      for attempt in 1 2 3; do
        if osascript \
          -e 'tell application "Cursor" to activate' \
          -e 'delay 0.8' \
          -e 'tell application "System Events" to tell process "Cursor"' \
          -e 'if frontmost is false then error "CURSOR_NOT_FRONTMOST"' \
          -e 'click (first menu item of menu "Window" of menu bar 1 whose name contains "'"$PROJ"'")' \
          -e 'delay 0.4' \
          -e 'set markVal to value of attribute "AXMenuItemMarkChar" of menu item "Secondary Side Bar" of menu 1 of menu item "Appearance" of menu "View" of menu bar 1' \
          -e 'if markVal is not missing value then' \
          -e '  key code 34 using command down' \
          -e '  delay 0.35' \
          -e 'end if' \
          -e 'key code 34 using command down' \
          -e 'delay 0.6' \
          -e 'if frontmost is false then error "FOCUS_LOST_BEFORE_PASTE"' \
          -e 'key code 9 using command down' \
          -e 'delay 0.35' \
          -e 'set pastedOK to false' \
          -e 'try' \
          -e '  set focusEl to value of attribute "AXFocusedUIElement"' \
          -e '  set focusVal to value of attribute "AXValue" of focusEl' \
          -e '  if focusVal contains "ui-executor.mdc" then set pastedOK to true' \
          -e 'end try' \
          -e 'if pastedOK is false then' \
          -e '  key code 6 using command down' \
          -e '  error "PASTE_VERIFICATION_FAILED_ROLLED_BACK"' \
          -e 'end if' \
          -e 'key code 36' \
          -e 'end tell' >/dev/null 2>&1; then
          return 0
        fi
        sleep 2
      done
      return 1
    }

    trigger_cursor
    INIT_HASH="$(shasum task.md 2>/dev/null | awk '{print $1}')"
    RETRIED=0

    for i in $(seq 1 48); do
      sleep 15
      CUR_HASH="$(shasum task.md 2>/dev/null | awk '{print $1}')"
      RECENT_EDIT="$(find . -maxdepth 3 -not -path '*/.*' -not -path './node_modules*' -mmin -2 2>/dev/null | head -n 1)"
      if [ "$i" -ge 6 ] && [ "$RETRIED" -eq 0 ] && [ "$CUR_HASH" = "$INIT_HASH" ] && [ -z "$RECENT_EDIT" ]; then
        RETRIED=1
        trigger_cursor
      fi
      if ! grep -Eq '^\s*[-*]\s*\[( |!)\]' task.md && ! pgrep -f "next build|vite build|tsc" >/dev/null 2>&1; then
        sleep 3
        break
      fi
    done

    osascript -e 'tell application "Antigravity" to activate' >/dev/null 2>&1
    echo "CURSOR_ROUND_COMPLETED"

2. 當上述指令返回 `CURSOR_ROUND_COMPLETED` 後，**立刻執行【單輪驗收與退回步驟】**（Round 2+ 優先使用 `git diff` 審查）；若仍未達 `>= 9.0` 分（且所有維度 `>= 1.7`、零上市紅線），則立刻再次執行步驟 1 進入下一輪，直到正式達標結案為止。
