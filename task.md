# Task Board — 全站任務模板歸屬識別徽章 ＋ 直達管理動線（框架級方案 A）

## 【上市產品成熟度驗收儀表板】
- **當前輪次**：Round 1（一次達標結案）
- **最新總分**：**9.5 / 10.0**（門檻 `>= 9.0` 且全維度 `>= 1.7`）
- **上市紅線狀態**：✅ 零上市紅線（`tsc` exit 0、`vitest` 26 files / 277 tests 全綠、`next build` 編譯通過、紅線與 Next.js 安全掃描零命中）
- **五維度評分明細**：
  1. 核心價值與業務閉環：**1.9 / 2.0**（四大任務視圖一眼辨識歸屬模板、詳情卡直達 `/settings?plan=<id>#installed-plans` 平滑捲動並高亮對應模板）
  2. 視覺工藝與品牌信任感：**1.9 / 2.0**（全面採用 `DESIGN_SYSTEM.md` CSS Token 支援深淺主題、統一 Lucide `<Layers />` / `<ExternalLink />`、零紅色系）
  3. 微互動與多端適配體驗：**1.9 / 2.0**（長名 `truncate` 防 375px 破版、節奏槽響應式顯示、44px 手機熱區、`focus-visible:ring-2` 與 300ms 高亮過渡）
  4. 極端邊界與防呆韌性：**1.9 / 2.0**（`SourcePlanBadge` 純展示零重複請求、`RhythmSection` 避開 `useSearchParams` 靜態預渲染陷阱、計時器完整清理）
  5. 商業細節與上市合規度：**1.9 / 2.0**（溫柔精準 `title`/`aria-label`、遵守 `§5a` 列表不誤觸跳轉）
- **已歸檔紀錄**：完整明細已歸檔至 [docs/task-archive.md](docs/task-archive.md)。

---

## 本輪已結案 (`[x]`)
- [x] **Step 1–2. `sourcePlan.ts` 新增 `INSTALLED_PLANS_ANCHOR_ID`/`buildPlanSettingsHref`/`getSourcePlanDisplayName` 與 `sourcePlan.test.ts` 單元測試（12 tests 全綠）**
- [x] **Step 3–4. 新增純展示 `SourcePlanBadge.tsx` 並接入 `TaskListItem`、`TaskCard`、`CalendarView`、`SlotTaskRow`**
- [x] **Step 5. `TaskDetailPanel.tsx` 歸屬模板資訊卡與直達管理連結 ＋ `RhythmSection.tsx` `?plan=` 平滑捲動高亮**
- [x] **Step 6–7. 靜態紅線與安全掃描零命中 + Build Gate 驗收：`tsc` exit 0、`vitest` 26 檔 / 277 測試全綠、`next build` 編譯通過**
