/**
 * IME 輸入法 composition 防護
 *
 * 解決：中文(注音/拼音/倉頡等)選字完成時，按 Enter 的瞬間會先觸發 keyDown，
 * 再觸發 compositionEnd 把中文字 commit 進 input。若 keyDown 處理函式此時
 * 就執行「送出表單/建立任務」動作，會在中文還沒進到 state 之前就誤觸發。
 *
 * 重要（基於 Mac Chrome 注音實測）：
 *   監聽 onKeyUp 是錯的！
 *   - keyDown 時：isComposing=true  ← 可以可靠攔
 *   - compositionEnd 觸發
 *   - keyUp 時：isComposing=false  ← 永遠擋不住
 *   所以 Enter 提交邏輯一定要掛 onKeyDown，不要用 onKeyUp。
 *
 * 用法（keyDown handler）：
 *   onKeyDown={(e) => {
 *     if (isComposingKey(e)) return;
 *     if (e.key === "Enter") handleSubmit();
 *   }}
 *
 * 用法（form onSubmit）：
 *   onSubmit={(e) => {
 *     if (isComposingSubmit(e)) return;
 *     handleSubmit(e);
 *   }}
 *
 * 涵蓋瀏覽器：
 * - Chromium（Chrome / Edge / Brave）：原生 isComposing 旗標
 * - WebKit（Safari / iOS Safari）：原生 isComposing 旗標
 * - Firefox：原生 isComposing 旗標
 * - 舊瀏覽器 fallback：keyCode 229（已被 React/瀏覽器 deprecate，但當雙保險）
 */
import type { FormEvent, KeyboardEvent } from "react";

export function isComposingEvent(e: KeyboardEvent | FormEvent): boolean {
  // React 把原生 event 掛在 nativeEvent；某些 SyntheticEvent 不一定有 nativeEvent
  const native = (e as unknown as { nativeEvent?: { isComposing?: boolean; keyCode?: number } }).nativeEvent;
  if (native?.isComposing) return true;
  // 兼容舊瀏覽器（陳年 Android 內建 WebView 之類）
  if (typeof native?.keyCode === "number" && native.keyCode === 229) return true;
  return false;
}

export function isComposingKey(e: KeyboardEvent): boolean {
  return isComposingEvent(e);
}

export function isComposingSubmit(e: FormEvent): boolean {
  return isComposingEvent(e);
}
