# Task Board — 任務與習慣就地番茄鐘（分裂膠囊 ＋ 自訂時長 ＋ 頁面小計｜方案 A）

## 【上市產品成熟度驗收儀表板】
- **當前輪次**：Round 2（達標結案）
- **最新總分**：**9.4 / 10.0**（門檻 `>= 9.0` 且全維度 `>= 1.7`；Round 1: `7.5` → Round 2: `9.4`）
- **上市紅線狀態**：✅ 零上市紅線（`tsc` exit 0、`vitest` 27 files / 295 tests 全綠、`next build` 36/36 頁編譯通過、紅線掃描零命中）
- **五維度評分明細**：
  1. 核心價值與業務閉環：**1.9 / 2.0**（任務與習慣統一單一分裂膠囊、自訂時長記憶、頁頭與列內小計、`TaskPomodoroBridge` 與全站 `todayFocusMinutes` 完整閉環）
  2. 視覺工藝與品牌信任感：**1.9 / 2.0**（全面採用 `DESIGN_SYSTEM.md` CSS Token 支援深淺主題、統一 Lucide Icon、`tabular-nums` 對齊、習慣卡瘦身、零紅色系）
  3. 微互動與多端適配體驗：**1.8 / 2.0**（手機端 `opacity-90` 觸控可見、展開 Popover 鎖定顯示、375px `flex-wrap` 防溢位、Esc/Enter 與 `isComposingKey` 中文輸入保護）
  4. 極端邊界與防呆韌性：**1.9 / 2.0**（1–180 分鐘輸入清理、任務／習慣互斥綁定、`busy-other`/封存態雙層阻斷 Popover、暫停態續跑與手動計數器同步鎖定）
  5. 商業細節與上市合規度：**1.9 / 2.0**（無投資不說 0、完整 ARIA 無障礙屬性、嚴守 §5a 流程鎖定不跳頁不彈窗）
- **已歸檔紀錄**：完整明細已歸檔至 [docs/task-archive.md](file:///Users/liangzhiwei/Documents/VIbe%20Coding/任務管理器/docs/task-archive.md)。

---

## 本輪已結案 (`[x]`)
- [x] **Step 1–2. 擴充 `Task` 型別、建立 `pomodoroHelpers.ts`（13 tests）與修補 `usePomodoro.ts` 互斥綁定＋`pausedTarget`（10 tests）**
- [x] **Step 3–4. 補齊 `TaskPomodoroBridge` 與全站 `todayFocusMinutes`，並升級 `IconPopover.tsx` 受控與 `disabled` 模式**
- [x] **Step 5. 新增共用 `PomodoroSplitPill.tsx`（Round 2 修復 `overflow-hidden` 裁切、`stopPropagation` 死按鈕與手機端可見性）**
- [x] **Step 6–7. 接入 `TaskListItem` / `SortableTaskItem` / `AppShell` 頁頭小計，並收斂 `HabitsPage` 番茄排與暫停鎖定**
- [x] **Step 8. Build Gate 全綠驗收：`tsc` exit 0、`vitest` 27 檔 / 295 測試全綠、`next build` 編譯通過、紅線 0 命中**
