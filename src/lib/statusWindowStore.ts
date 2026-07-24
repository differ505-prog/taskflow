"use client";

import { create } from "zustand";

/**
 * 全域狀態窗 Store
 *
 * 設計給「任務完成 / 升級 / 解鎖成就」這類 RPG 遊戲感事件使用。
 * 任何頁面呼叫 useStatusWindow().window(payload) 都會在 StatusWindow 元件觸發顯示。
 *
 * 自動消散時間: 2.5s（規格要求）
 * 無遮罩、無需點擊關閉（規格要求）
 */

export type StatusWindowPayload = {
  /** 顯示在狀態窗主標題 */
  title?: string;
  /** 副標題/說明,例如 "任務已完成。經驗值 +100" */
  message: string;
  /** 經驗值變化(可選) */
  xpDelta?: number;
  /** 等級變化(可選) */
  levelUpTo?: number;
  /** 圖示 emoji 或字符(可選) */
  icon?: string;
};

type StatusWindowState = {
  payload: StatusWindowPayload | null;
  /** 顯示狀態窗 (內部定時自動 dismiss) */
  show: (payload: StatusWindowPayload) => void;
  /** 主動關閉(極少用,規格要求自動消失) */
  dismiss: () => void;
};

export const useStatusWindowStore = create<StatusWindowState>((set) => ({
  payload: null,
  show: (payload) => set({ payload }),
  dismiss: () => set({ payload: null }),
}));
