# 方案 B：習慣番茄鐘體驗強化（計數修復 + 音效升級 + 雙維度累計時長）

> **狀態**：✅ 驗收通過，已全部實作完成  
> **改動範圍**：`src/lib/usePomodoro.ts`、`src/lib/ZenFlowProvider.tsx`、`src/components/FlowTimerModal.tsx`、`src/components/HabitsPage.tsx`、`src/lib/completionSound.ts`

---

## 🎯 目標與驗收標準

1. **番茄計數 100% 成功入帳**：習慣卡片啟動番茄鐘結束時，對應習慣當日番茄數必然 `+1`，並同步自動打卡（若達標）。
2. **音效清晰具穿透力**：計時結束時播放雙聲道/高穿透清脆鐘聲（音量 100%），並伴隨設備震動（支援震動的瀏覽器/PWA）。
3. **個別習慣時長雙維度展示**：每張習慣卡片清楚顯示「今日專注 X 分」與「歷史累計 Y 小時/分」，提供即時成就回饋。

---

## 📋 逐步實作清單

### 階段一：修復計時器閉包狀態丟失 Bug
- [x] **檔案**：`src/lib/usePomodoro.ts`（使用 Ref 消除非同步更新延遲，修復時鐘停止與回呼執行序）

### 階段二：提示音穿透力與多重反饋升級
- [x] **檔案**：`src/lib/completionSound.ts`、`src/lib/ZenFlowProvider.tsx`、`src/components/FlowTimerModal.tsx`（Web Audio A5+A6 雙音鐘聲 + 100% 音量 + 震動回饋）

### 階段三：個別習慣卡片顯示累計時間
- [x] **檔案**：`src/components/HabitsPage.tsx`（新增「今日/指定日 X 分 · 累計投入 Y 小時」雙維度時長徽章）

### 階段四：自動化測試與回歸檢驗
- [x] 執行專案測試（108/108 全數通過）：`npm test`
- [x] 執行生產建置（Build 成功）：`npm run build`
- [ ] 驗證 Checklist：
  1. 點擊習慣上的 `🍅 5` 開始計時。
  2. 檢查計時結束時：
     * 是否發出清晰響亮的提示音與震動？
     * 習慣卡片上的當日番茄數是否自動由 `0` 變為 `×1`？
     * 習慣卡片上的「今日專注」與「累計投入」是否立即同步更新？
