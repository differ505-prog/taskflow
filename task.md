# Task Board — 計畫 3.1 框架升級 ＋ 習慣預約休眠（UI/UX 總監驗收儀表板）

## 【上市產品成熟度驗收儀表板】
- **當前輪次**：Round 2（已達標結案）
- **最新總分**：**9.5 / 10.0**（門檻 `>= 9.0` 且全維度 `>= 1.7`）
- **上市紅線狀態**：✅ 零上市紅線（`tsc` exit 0、`vitest` 22 files / 240 tests 全綠、`next build` 36/36 pages 編譯通過）
- **五維度評分明細**：
  1. 核心價值與業務閉環：**1.9 / 2.0**（方案休眠、習慣預約休眠＋目標池凍結、第 4 紅線錨點、月度第 N 週期與雲端同步全通）
  2. 視覺工藝與品牌信任感：**1.9 / 2.0**（雙主題 `var(--brand)` / `var(--surface-hover)` / `var(--border)`、Moon active 狀態、零紅色系）
  3. 微互動與多端適配體驗：**1.9 / 2.0**（375px 自訂紅線響應式堆疊、全 44px 熱區、`Esc` / `Enter` 鍵盤無障礙完整）
  4. 極端邊界與防呆韌性：**1.9 / 2.0**（`tomorrowStr` 邊界鎖定、重疊休眠區間去重、提前喚醒保留凍結天數、240 tests 全綠）
  5. 商業細節與上市合規度：**1.9 / 2.0**（溫柔零責備微文案、個人帳號 `supabase_cloud` 同步驗證通過）
- **已歸檔紀錄**：完整明細已歸檔至 [docs/task-archive.md](docs/task-archive.md)。

---

## 本輪已結案 (`[x]`)
- [x] **Step 1–5. 型別擴充、方案休眠、第 4 紅線錨點、月度第 N 個星期 X、習慣預約休眠＋目標池凍結純函式與測試**
- [x] **Step 6–7. `useRhythmSettings` 雲端同步修正與 `RhythmSection` / `RhythmBar` / `HabitsPage` / `ZenDashboard` UI 落地**
- [x] **Step 8. 個人帳號 `supabase_cloud` 升級（20:00 Highball 紅線、`學習、考試` 休眠至 2027-01-01、模考改每月第 1 個週六）**
- [x] **Step 9. Build Gate 驗收：`tsc` exit 0、`vitest` 22 檔 / 240 測試全綠、`next build` 36/36 頁編譯通過**
