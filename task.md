# Task Board — 收集箱一眼辨識未排期：輕量日期 Chip ＋ 雙區分組（方案 A）

## 【上市產品成熟度驗收儀表板】
- **當前輪次**：Round 1（一次達標結案）
- **最新總分**：**9.3 / 10.0**（門檻 `>= 9.0` 且全維度 `>= 1.7`）
- **上市紅線狀態**：✅ 零上市紅線（`tsc` exit 0、`vitest` 26 files / 274 tests 全綠、`next build` 編譯通過、紅線 grep 零命中）
- **五維度評分明細**：
  1. 核心價值與業務閉環：**1.9 / 2.0**（輕量日期 Chip 補齊 >72h 盲點、收集箱雙區分組守恆、`撈幾件來排` 收斂至未排期標題列右側）
  2. 視覺工藝與品牌信任感：**1.8 / 2.0**（全 CSS Token 雙主題與 Lucide 圖示統一、零無日期貼紙噪音；`<summary>` 沿用既有 `hover:bg-black/[0.03]`）
  3. 微互動與多端適配體驗：**1.8 / 2.0**（桌面拖曳、36px 手機熱區、折疊旋轉與平滑進退場過渡；`<summary>` 內層按鈕具 `focus-visible:ring-2`）
  4. 極端邊界與防呆韌性：**1.9 / 2.0**（`partitionInboxActiveTasks` 零遺漏零重複、單段為空安全隱藏、非收集箱視圖零回歸）
  5. 商業細節與上市合規度：**1.9 / 2.0**（溫柔微文案 `尚未排期` / `已排好日期`、`aria-label` 與 `title` 完整）
- **已歸檔紀錄**：完整明細已歸檔至 [docs/task-archive.md](docs/task-archive.md)。

---

## 本輪已結案 (`[x]`)
- [x] **Step 1–2. `smartReschedule.ts` 新增 `formatTaskScheduleChip` / `partitionInboxActiveTasks` 與 `smartReschedule.test.ts` 7 項新測試（23 tests 全綠）**
- [x] **Step 3. `TaskListItem.tsx` 補齊 >72h 靜態輕量日期 Chip（Lucide `Calendar` + CSS Token），無日期任務保持乾淨留白**
- [x] **Step 4. `AppShell.tsx` 個人收集箱雙區分組（`尚未排期` ＋ 可折疊 `已排好日期`），並將 `撈幾件來排` 收斂至未排期區段右側**
- [x] **Step 5–6. 靜態紅線掃描零命中 + Build Gate 驗收：`tsc` exit 0、`vitest` 26 檔 / 274 測試全綠、`next build` 編譯通過**
