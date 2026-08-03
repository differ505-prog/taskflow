import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FormEvent, KeyboardEvent } from "react";
import { isComposingKey, isComposingSubmit, isComposingEvent } from "@/utils/imeGuard";

/**
 * §15.4 mobile input 特殊性:IME composition 期間攔截
 * §18d.1 / §26-C 同類 bug 防護
 *
 * 關鍵情境:
 * 1. 中文輸入法(注音/拼音)選字中:isComposing=true → 必須 return true 攔截 Enter
 * 2. 一般英文鍵盤輸入:isComposing=false → 必須 return false 放行 Enter
 * 3. 舊瀏覽器 fallback:keyCode 229 → 必須 return true
 * 4. 沒有 nativeEvent 的 SyntheticEvent → 必須 return false 不誤擋
 */
describe("imeGuard (§15.4 mobile input composition 防護)", () => {
  const makeKeyEvent = (overrides: {
    isComposing?: boolean;
    keyCode?: number;
  }): KeyboardEvent => {
    return {
      nativeEvent: {
        isComposing: overrides.isComposing ?? false,
        keyCode: overrides.keyCode ?? 0,
      },
    } as unknown as KeyboardEvent;
  };

  const makeFormEvent = (overrides: {
    isComposing?: boolean;
    keyCode?: number;
  }): FormEvent => {
    return {
      nativeEvent: {
        isComposing: overrides.isComposing ?? false,
        keyCode: overrides.keyCode ?? 0,
      },
    } as unknown as FormEvent;
  };

  describe("isComposingKey (onKeyDown 攔截)", () => {
    it("中文選字中 (isComposing=true) → 必須 return true", () => {
      const e = makeKeyEvent({ isComposing: true });
      expect(isComposingKey(e)).toBe(true);
    });

    it("英文輸入 (isComposing=false) → 必須 return false 放行 Enter", () => {
      const e = makeKeyEvent({ isComposing: false });
      expect(isComposingKey(e)).toBe(false);
    });

    it("舊瀏覽器 keyCode=229 → 必須 return true (fallback)", () => {
      const e = makeKeyEvent({ isComposing: false, keyCode: 229 });
      expect(isComposingKey(e)).toBe(true);
    });

    it("普通 keyCode (Enter=13) → 必須 return false", () => {
      const e = makeKeyEvent({ isComposing: false, keyCode: 13 });
      expect(isComposingKey(e)).toBe(false);
    });

    it("沒有 nativeEvent 的事件 → 必須 return false 不誤擋", () => {
      const e = {} as KeyboardEvent;
      expect(isComposingKey(e)).toBe(false);
    });
  });

  describe("isComposingSubmit (form onSubmit 攔截)", () => {
    it("composition 期間送出表單 → 必須 return true 攔截", () => {
      const e = makeFormEvent({ isComposing: true });
      expect(isComposingSubmit(e)).toBe(true);
    });

    it("一般送出表單 → 必須 return false", () => {
      const e = makeFormEvent({ isComposing: false });
      expect(isComposingSubmit(e)).toBe(false);
    });
  });

  describe("isComposingEvent (通用 base 函式)", () => {
    it("KeyboardEvent 與 FormEvent 都應支援", () => {
      expect(isComposingEvent(makeKeyEvent({ isComposing: true }))).toBe(true);
      expect(isComposingEvent(makeFormEvent({ isComposing: true }))).toBe(true);
    });
  });
});
