"use client";

/**
 * 任務完成慶祝動畫模組
 *
 * 設計：組合式多波慶祝動畫（共四波，總粒子數 ~195，總時長 ~800ms）
 * - T+0ms   雙側 side cannons（左右各 30 顆，「砰」開香檳感）
 * - T+0ms   中心向上爆發 80 顆（高速度 45，主爆點）
 * - T+150ms 向下墜落 50 顆（realistic gravity，逆轉感）
 * - T+300ms 5 顆星星 emoji ✨ 收尾
 *
 * 主反饋 ≤ 200ms 由 haptic 提供（憲法 §4 微互動原則），
 * 動畫只裝飾延長，不影響 perceived performance。
 *
 * 觸發條件（呼叫方負責）：
 * - 主任務從非 done 切換到 done 時
 * - 子任務不觸發（避免過度刺激）
 * - 共享任務由他人完成時不觸發（避免協作混亂）
 */

import confetti from "canvas-confetti";

const STORAGE_KEY = "taskflow_confetti_enabled";
const SOUND_STORAGE_KEY = "taskflow_confetti_sound_enabled";

// ─── Sound synthesis (Web Audio API) ─────────────────────────
function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function _getConfettiEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}
function getEnabled(): boolean { return _getConfettiEnabled(); }

/** 供 SettingsPage 讀取目前開關狀態 */
export function getConfettiEnabled(): boolean { return _getConfettiEnabled(); }

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

/**
 * 播放清脆完成音效（Web Audio API 即時合成，無需外部音檔）
 * 音色：上行的 C5→E5→G5 和弦，短促清脆，符合福格模型的正向回饋
 */
export function playTaskDoneSound(): void {
  if (typeof window === "undefined") return;
  if (!getSoundEnabled()) return;
  if (prefersReducedMotion()) return;

  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // 三音符和弦：C5(523Hz) + E5(659Hz) + G5(784Hz)，每個間隔 60ms
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + i * 0.06;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  } catch {
    // 音效失敗靜默忽略
  }
}

export function setConfettiSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // 寫入失敗靜默忽略
  }
}

export function getConfettiSoundEnabled(): boolean {
  return getSoundEnabled();
}

/**
 * 從指定 DOM 元素位置向外發射組合式慶祝動畫
 * @param originEl 觸發按鈕的 DOM 元素（用於計算發射座標）
 */
export function fireTaskDoneConfetti(originEl: HTMLElement | null) {
  // 三道防護：SSR / 設定關閉 / reduced-motion
  if (typeof window === "undefined") return;
  if (!getEnabled()) return;
  if (prefersReducedMotion()) return;

  // 計算發射原點（以視窗座標為準）
  let originX = 0.5;
  let originY = 0.5;
  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    originX = (rect.left + rect.width / 2) / window.innerWidth;
    originY = (rect.top + rect.height / 2) / window.innerHeight;
  }

  const baseOpts = {
    zIndex: 9999,
    disableForReducedMotion: true,
    colors: COLORS,
  };

  // ── 波 1（同時）：雙側 side cannons（左右各 30 顆）─────
  confetti({
    ...baseOpts,
    particleCount: 30,
    angle: 60,
    spread: 55,
    startVelocity: 55,
    gravity: 0.8,
    ticks: 220,
    origin: { x: 0, y: originY },
    // 從左下角斜上發射
  });
  confetti({
    ...baseOpts,
    particleCount: 30,
    angle: 120,
    spread: 55,
    startVelocity: 55,
    gravity: 0.8,
    ticks: 220,
    origin: { x: 1, y: originY },
    // 從右下角斜上發射
  });

  // ── 波 2（同時）：中心向上爆發 80 顆（主爆點）─────
  confetti({
    ...baseOpts,
    particleCount: 80,
    angle: 90,
    spread: 75,
    startVelocity: 45,
    gravity: 1.2,
    ticks: 250,
    scalar: 1.1,
    origin: { x: originX, y: originY },
  });

  // ── 波 3（+150ms）：向下墜落 50 顆（realistic 模式，逆轉感）─────
  setTimeout(() => {
    if (!getEnabled() || prefersReducedMotion()) return;
    confetti({
      ...baseOpts,
      particleCount: 50,
      angle: 270, // 向下
      spread: 90,
      startVelocity: 25,
      gravity: 1.5,
      ticks: 200,
      scalar: 0.9,
      origin: { x: originX, y: originY - 0.05 },
    });
  }, 150);

  // ── 波 4（+300ms）：星星 ✨ emoji 收尾（punchline）─────
  setTimeout(() => {
    if (!getEnabled() || prefersReducedMotion()) return;
    const starShape = confetti.shapeFromText({ text: "✨", scalar: 2.5 });
    confetti({
      ...baseOpts,
      particleCount: 5,
      angle: 90,
      spread: 360,
      startVelocity: 20,
      gravity: 0.6,
      ticks: 300,
      scalar: 2.5,
      shapes: [starShape],
      origin: { x: originX, y: originY },
    });
  }, 300);
}

/**
 * 設定面板呼叫：更新 localStorage 並廣播變化
 */
export function setConfettiEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
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

/**
 * 設定面板呼叫：手動觸發一次預覽
 * 從頁面下方中心向上 + 雙側 cannons 完整體驗
 */
export function previewConfetti(): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  const baseOpts = {
    zIndex: 9999,
    disableForReducedMotion: true,
    colors: COLORS,
  };

  // 雙側 cannons
  confetti({
    ...baseOpts,
    particleCount: 40,
    angle: 60,
    spread: 55,
    startVelocity: 55,
    origin: { x: 0, y: 1 },
  });
  confetti({
    ...baseOpts,
    particleCount: 40,
    angle: 120,
    spread: 55,
    startVelocity: 55,
    origin: { x: 1, y: 1 },
  });

  // 中心爆發
  confetti({
    ...baseOpts,
    particleCount: 100,
    angle: 90,
    spread: 80,
    startVelocity: 50,
    origin: { x: 0.5, y: 0.6 },
  });

  // 星星收尾
  setTimeout(() => {
    const starShape = confetti.shapeFromText({ text: "✨", scalar: 2.5 });
    confetti({
      ...baseOpts,
      particleCount: 8,
      spread: 360,
      startVelocity: 25,
      shapes: [starShape],
      scalar: 2.5,
      origin: { x: 0.5, y: 0.6 },
    });
  }, 300);
}