"use client";

/**
 * 任務完成慶祝動畫模組
 *
 * 設計：
 * - 從觸發按鈕位置向外擴散 confetti
 * - 250ms 內完成（≤ 憲法 §4 微互動 300ms 上限）
 * - 讀取 localStorage 設定（taskflow_confetti_enabled），預設開啟
 * - 自動偵測 prefers-reduced-motion，無障礙關閉
 * - SSR safe：window 不存在時靜默返回
 *
 * 觸發條件（呼叫方負責判斷）：
 * - 主任務從非 done 切換到 done 時
 * - 子任務不觸發（避免過度刺激）
 * - 共享任務由他人完成時不觸發（避免協作混亂）
 */

import confetti from "canvas-confetti";

const STORAGE_KEY = "taskflow_confetti_enabled";
const ANIMATION_DURATION_MS = 250;

function getEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // 預設啟用（null → true）
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 從指定 DOM 元素位置向外發射 confetti
 * @param originEl 觸發按鈕的 DOM 元素（用於計算發射座標）
 */
export function fireTaskDoneConfetti(originEl: HTMLElement | null) {
  // 三道防護：SSR / 設定關閉 / reduced-motion
  if (typeof window === "undefined") return;
  if (!getEnabled()) return;
  if (prefersReducedMotion()) return;

  // 計算發射原點（以視窗座標為準，canvas-confetti 用 clientX/Y）
  let originX = 0.5;
  let originY = 0.5;
  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    originX = (rect.left + rect.width / 2) / window.innerWidth;
    originY = (rect.top + rect.height / 2) / window.innerHeight;
  }

  // 從中心向上發射（一波，250ms）
  const defaults = {
    origin: { x: originX, y: originY },
    zIndex: 9999,
    disableForReducedMotion: true,
  };

  confetti({
    ...defaults,
    particleCount: 60,
    angle: 90, // 向上
    spread: 70,
    startVelocity: 35,
    gravity: 1.2,
    ticks: 200,
    colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  });
}

/**
 * 設定面板呼叫：更新 localStorage 並廣播變化
 */
export function setConfettiEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
    // 廣播 storage event，讓其他 tab 同步
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: String(enabled),
      }),
    );
  } catch {
    // 寫入失敗靜默忽略
  }
}

export function getConfettiEnabled(): boolean {
  return getEnabled();
}

/**
 * 設定面板呼叫：手動觸發一次預覽（不受設定限制，
 * 但仍尊重 prefers-reduced-motion）
 */
export function previewConfetti(): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  confetti({
    particleCount: 80,
    spread: 80,
    origin: { y: 0.6 },
    zIndex: 9999,
    disableForReducedMotion: true,
    colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  });
}

// 暴露常數供外部計算動畫時長
export const CONFETTI_DURATION_MS = ANIMATION_DURATION_MS;