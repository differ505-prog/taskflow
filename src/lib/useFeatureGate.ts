"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Feature Gate 守衛 hook
 *
 * 用途：任何需要 PRO 權限的功能（自訂標籤顏色、總覽儀表板、批次重命名等）
 * 都透過這個 hook 取得鎖定狀態，避免每個元件各寫一套判斷邏輯。
 *
 * 設計原則：
 * 1. **多數決（admin ∪ pro ∪ beta）**：PRO 邊界實作採方案 X
 *    beta 用戶保留早期測試體驗，自訂顏色仍可用
 * 2. **早期退出**：loading 期間鎖定由 AuthContext 提供 roleConfig.canUpload 統一處理
 * 3. **沒有副作用**：不寫 useEffect、不依賴時序，呼叫即得答案
 * 4. **Feature 名單獨鎖定**：每個 feature 可獨立判斷鎖定，不需要把整個 useFeatureGate 全部解鎖
 *
 * @example
 *   const rename = useFeatureGate("tag-rename");
 *   <button disabled={rename.locked} title={rename.locked ? "PRO 專屬" : ""}>
 *
 * @see src/lib/types.ts ROLE_CONFIGS
 * @see src/lib/AuthContext.tsx 角色優先級
 */
export type ProFeature =
  | "advanced-tags"           // 進階標籤管理後台
  | "stats-dashboard"        // 統計儀表板
  | "cloud-attachments"       // 雲端檔案與富文本評論
  | "storage-cleaner"         // 空間清理器
  | "zip-backup"             // ZIP 輕量備份
  | "storage-expansion"       // 擴充包
  | "karma-mode"             // 心靈還債引擎
  | "domino-tasks";          // 漸進式專案解鎖模組

export interface FeatureGateResult {
  /** 是否被鎖（free 用戶） */
  locked: boolean;
  /** 鎖定原因（給 UI 顯示） */
  reason: "free-tier" | "not-signed-in" | null;
  /** 點擊升級按鈕時呼叫：開啟升級 modal（由 SideBar 統一管理） */
  requestUnlock: () => void;
  /** 控制升級 modal 的 state（供 UI 守衛入口綁定） */
  upgradeModalOpen: boolean;
  closeUpgradeModal: () => void;
}

export function useFeatureGate(feature?: ProFeature): FeatureGateResult {
  const { user, isAdmin, isPro, isBeta, isFree } = useAuth();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // 多數決：admin ∪ pro ∪ beta = 全部解鎖（PRO 邊界實作採方案 X：向後相容，不影響 beta 體驗）
  const unlocked = isAdmin || isPro || isBeta;

  // feature 存在但目前所有 feature 都用同一鎖定規則（admin ∪ pro ∪ beta）
  // 未來若 feature 需要更細的鎖定（例如 batch 只限 PRO 排除 beta），在此擴充
  void feature;

  const reason: FeatureGateResult["reason"] = !user
    ? "not-signed-in"
    : unlocked
    ? null
    : "free-tier";

  const requestUnlock = useCallback(() => {
    setUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
  }, []);

  return {
    locked: reason !== null,
    reason,
    requestUnlock,
    upgradeModalOpen,
    closeUpgradeModal,
  };
}