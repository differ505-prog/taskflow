"use client";

/**
 * feedbackContext — 自動打包反饋送出時的 metadata
 *
 * 設計動機(§B 評分 9.2):
 *   使用者按「送出反饋」時,機器自動合併當下狀態 → 開發者收到反饋時
 *   已知道「哪個路由、哪個 console error、最後 5 個使用者動作」,
 *   不用使用者打字描述 bug,大幅降低反饋摩擦。
 *
 * 對齊既有 pattern(§25):
 *   - 與 useDiscordNotifier 相同命名風格
 *   - 全域 module-level Ring Buffer(無 useState,避免 re-render)
 *
 * 隱私(§8):
 *   - 不收集 input / textarea 內容(避免誤抓到使用者密碼)
 *   - 攔截 console 預設只看 error / warn,不看 log
 *   - 最後 N 個 user action 只記錄「點擊了哪個按鈕」,不記內容
 */

const MAX_CONSOLE_ENTRIES = 20;
const MAX_ACTIONS = 10;

interface ConsoleEntry {
  level: "error" | "warn";
  message: string;
  timestamp: number;
}

interface UserAction {
  type: "click" | "navigate" | "input";
  target: string;
  timestamp: number;
}

const consoleBuffer: ConsoleEntry[] = [];
const actionBuffer: UserAction[] = [];

let installed = false;

/**
 * 安裝 client-side interceptor,只跑一次(module-level flag)。
 * 主要捕獲 console.error / console.warn,以及輕量的 click 事件。
 *
 * §14.2 O' 雙 hook state 死鎖預防:這是 module-level,不用 React state,
 * 因此不會撞 §O' 同 UI 雙 state 衝突。
 */
export function installFeedbackInterceptors(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // 1. console 攔截
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]) => {
    pushConsole("error", args);
    origError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    pushConsole("warn", args);
    origWarn.apply(console, args);
  };

  // 2. click 攔截(只讀 data-feedback-target 或 [aria-label])
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const closer = target.closest<HTMLElement>(
      "[data-feedback-target], [aria-label], button"
    );
    if (!closer) return;
    const label =
      closer.getAttribute("data-feedback-target") ||
      closer.getAttribute("aria-label") ||
      closer.textContent?.trim().slice(0, 50) ||
      closer.tagName;
    pushAction("click", label);
  };
  document.addEventListener("click", handleClick, { capture: true, passive: true });
}

function pushConsole(level: "error" | "warn", args: unknown[]): void {
  const message = args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ")
    .slice(0, 500);
  consoleBuffer.push({ level, message, timestamp: Date.now() });
  if (consoleBuffer.length > MAX_CONSOLE_ENTRIES) consoleBuffer.shift();
}

function pushAction(type: UserAction["type"], target: string): void {
  actionBuffer.push({
    type,
    target: target.slice(0, 100),
    timestamp: Date.now(),
  });
  if (actionBuffer.length > MAX_ACTIONS) actionBuffer.shift();
}

export interface FeedbackContextPayload {
  route: string;
  appVersion: string;
  userAgent: string;
  screenSize: string;
  viewport: string;
  online: boolean;
  recentConsoleErrors: number;
  recentConsoleWarnings: number;
  lastConsoleErrors: ConsoleEntry[];
  lastActions: UserAction[];
  collectedAt: string;
}

/**
 * 收集當下 metadata。在 FeedbackModal 開啟時呼叫一次。
 */
export function collectContext(): FeedbackContextPayload {
  return {
    route: typeof window !== "undefined" ? window.location.pathname : "",
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    screenSize:
      typeof window !== "undefined"
        ? `${window.screen.width}x${window.screen.height}`
        : "",
    viewport:
      typeof window !== "undefined"
        ? `${window.innerWidth}x${window.innerHeight}`
        : "",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    recentConsoleErrors: consoleBuffer.filter((c) => c.level === "error").length,
    recentConsoleWarnings: consoleBuffer.filter((c) => c.level === "warn").length,
    lastConsoleErrors: consoleBuffer.filter((c) => c.level === "error").slice(-5),
    lastActions: actionBuffer.slice(-MAX_ACTIONS),
    collectedAt: new Date().toISOString(),
  };
}

/**
 * 複製時用的 LLM 整理 prompt 模板。
 * 開發者按「📋 複製 + AI 整理」時,會複製包含 prompt + 多筆 feedback 的 markdown。
 */
export const FEEDBACK_LLM_PROMPT = `以下是 VibeList 封測/公測期用戶反饋批次,請幫忙歸納:

1. **重複出現的問題**:依出現次數排序,標出每個問題的代表訊息
2. **熱區路由/元件**:哪個路由 / 元件最常被提及
3. **優先級建議**:P0(必修)/ P1(下個迭代)/ P2(可有可無)
4. **新功能建議**:哪些值得做(已用戶主動提)
5. **假訊號過濾**:哪些是 spurious / 噪音 / 使用者誤會

回應格式:中文 markdown,每條結論附原始反饋編號。

---

`;
