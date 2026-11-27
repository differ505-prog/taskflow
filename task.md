# Task Board — 收集箱未排期任務：雙層漸進「撈取排程」（方案 A）

## 【上市產品成熟度驗收儀表板】
- **當前輪次**：Round 2（已達標結案）
- **最新總分**：**9.5 / 10.0**（門檻 `>= 9.0` 且全維度 `>= 1.7`）
- **上市紅線狀態**：✅ 零上市紅線（`tsc` exit 0、`vitest` 26 files / 267 tests 全綠、`next build` 編譯通過、紅線 grep 零命中）
- **五維度評分明細**：
  1. 核心價值與業務閉環：**1.9 / 2.0**（雙層 Pull-based 撈取排程閉環完整、收起重開重置選取、面板開啟保留收起鈕、跨元件每日上限即時同步）
  2. 視覺工藝與品牌信任感：**1.9 / 2.0**（全面採用 `DESIGN_SYSTEM.md` CSS Token 支援 `<html data-theme="dark">`、統一 `lucide-react` `<Leaf />`、零紅色系）
  3. 微互動與多端適配體驗：**1.9 / 2.0**（Toolbar `flex-wrap` 375px 零溢位、`AnimatePresence` + `<motion.li layout>` 滑順重排、44px 手機熱區、`focus-visible:ring-2` 與 `Esc` 關閉）
  4. 極端邊界與防呆韌性：**1.9 / 2.0**（空選零排程、Undo 直接寫 `updateTask` 無閉包過時問題、移除重複 haptic、離開 inbox 自動收起）
  5. 商業細節與上市合規度：**1.9 / 2.0**（溫柔零責備微文案、`aria-live="polite"` 動態回報已選件數）
- **已歸檔紀錄**：完整明細已歸檔至 [docs/task-archive.md](docs/task-archive.md)。

---

## 本輪已結案 (`[x]`)
- [x] **Step 1–3. `smartReschedule.ts` 共用 SSOT、選取式排程純函式、`smartReschedule.test.ts`（16 tests）與 `LostAndFound.tsx` 同步重構**
- [x] **Step 4. 新增 `InboxSmartPicker.tsx`（Pull-based 批量撈取面板、CSS Token 深淺主題、Lucide Icon、44px 熱區與滑順重排）**
- [x] **Step 5–6. `TaskListItem.tsx`、`SortableTaskItem.tsx` 單筆 `✨ 排 M/d` 微入口與 `AppShell.tsx` 個人收集箱串接（含 375px `flex-wrap` 與 5 秒復原）**
- [x] **Step 7–8. 靜態紅線掃描零違規 + Build Gate 驗收：`tsc` exit 0、`vitest` 26 檔 / 267 測試全綠、`next build` 編譯通過**
