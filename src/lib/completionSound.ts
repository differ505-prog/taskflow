"use client";

import { Howl } from "howler";

/**
 * §計時完成提示音（統一入口）
 *
 * 設計目標：背景播放、未戴耳機、手機靜音時都要「一定聽得見」。
 *
 * 三層保障：
 * 1. Web Audio API 雙音合成（880Hz A5 + 1760Hz A6，延音 1.5 秒）
 *    → 不依賴任何音檔，即使 /sounds/alarm.mp3 載入失敗也會響。
 * 2. Howler 播放 alarm.mp3，volume = 1.0
 *    → 保留原本的取樣音色（音色較厚、穿透力強）。
 * 3. navigator.vibrate([200, 100, 200])
 *    → 支援震動的瀏覽器 / PWA 會有明顯觸覺回饋。
 *
 * 所有失敗都必須靜默：音效不可用不代表核心功能失效。
 */

let cachedHowl: Howl | null = null;
let cachedCtx: AudioContext | null = null;

function getAlarmHowl(): Howl | null {
  if (typeof window === "undefined") return null;
  if (cachedHowl) return cachedHowl;
  try {
    cachedHowl = new Howl({
      src: ["/sounds/alarm.mp3"],
      volume: 1.0,
      html5: true, // 提升 iOS / PWA 環境的播放可靠性
    });
    return cachedHowl;
  } catch {
    return null;
  }
}

function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!cachedCtx) {
    try {
      cachedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  // 瀏覽器自動播放政策：suspended 時嘗試恢復（失敗也無妨，Howl 仍會出聲）
  if (cachedCtx.state === "suspended") {
    void cachedCtx.resume().catch(() => {});
  }
  return cachedCtx;
}

/** 單顆柔和弦鐘聲：正弦波 + 指數衰減 */
function playBellTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peak: number,
): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  } catch {
    // 單顆音失敗不影響其他層
  }
}

/** 播放計時完成提示音（Web Audio 雙音 + mp3 取樣，音量 100%） */
export function playCompletionChime(): void {
  const ctx = ensureAudioContext();
  if (ctx) {
    try {
      const now = ctx.currentTime;
      playBellTone(ctx, 880, now, 1.5, 0.6); // A5
      playBellTone(ctx, 1760, now + 0.18, 1.5, 0.45); // A6
    } catch {
      // 合成失敗時仍有 mp3 兜底
    }
  }

  const howl = getAlarmHowl();
  if (howl) {
    try {
      howl.volume(1.0);
      howl.play();
    } catch {
      // 啞巴 fail：音效失敗不影響核心功能
    }
  }
}

/** 震動回饋（支援震動的瀏覽器 / PWA） */
export function vibrateCompletion(): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // 忽略：不支援震動的環境
    }
  }
}

/** 計時完成：聲音 + 震動一次到位 */
export function notifyTimerComplete(): void {
  playCompletionChime();
  vibrateCompletion();
}
