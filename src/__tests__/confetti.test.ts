/**
 * confetti.test.ts — confetti module smoke tests
 *
 * 覆蓋: getConfettiEnabled / setConfettiEnabled / getConfettiSoundEnabled / setConfettiSoundEnabled
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared mock store — re-used across mock instances
const mockStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStore[key]; }),
  clear: vi.fn(() => { Object.keys(mockStore).forEach(k => delete mockStore[k]); }),
};

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("confetti module — storage persistence", () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", {
      localStorage: localStorageMock,
      dispatchEvent: vi.fn(),
    });
  });

  describe("getConfettiEnabled", () => {
    it("預設值為 true（無 storage 值）", async () => {
      vi.resetModules();
      const { getConfettiEnabled } = await import("@/lib/confetti");
      expect(getConfettiEnabled()).toBe(true);
    });

    it("storage 為 'true' 時回傳 true", async () => {
      mockStore["taskflow_confetti_enabled"] = "true";
      vi.resetModules();
      const { getConfettiEnabled } = await import("@/lib/confetti");
      expect(getConfettiEnabled()).toBe(true);
    });

    it("storage 為 'false' 時回傳 false", async () => {
      mockStore["taskflow_confetti_enabled"] = "false";
      vi.resetModules();
      const { getConfettiEnabled } = await import("@/lib/confetti");
      expect(getConfettiEnabled()).toBe(false);
    });

    it("window 不存在時回傳 false（SSR safe）", async () => {
      vi.stubGlobal("window", undefined);
      vi.resetModules();
      const { getConfettiEnabled } = await import("@/lib/confetti");
      expect(getConfettiEnabled()).toBe(false);
    });
  });

  describe("setConfettiEnabled", () => {
    it("寫入 'true' 到 localStorage", async () => {
      vi.resetModules();
      const { setConfettiEnabled } = await import("@/lib/confetti");
      setConfettiEnabled(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "taskflow_confetti_enabled",
        "true",
      );
    });

    it("寫入 'false' 到 localStorage", async () => {
      vi.resetModules();
      const { setConfettiEnabled } = await import("@/lib/confetti");
      setConfettiEnabled(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "taskflow_confetti_enabled",
        "false",
      );
    });

    it("window 不存在時不拋錯（SSR safe）", async () => {
      vi.stubGlobal("window", undefined);
      vi.resetModules();
      const { setConfettiEnabled } = await import("@/lib/confetti");
      expect(() => setConfettiEnabled(false)).not.toThrow();
    });
  });

  describe("getConfettiSoundEnabled", () => {
    it("預設值為 true（無 storage 值）", async () => {
      vi.resetModules();
      const { getConfettiSoundEnabled } = await import("@/lib/confetti");
      expect(getConfettiSoundEnabled()).toBe(true);
    });

    it("storage 為 'false' 時回傳 false", async () => {
      mockStore["taskflow_confetti_sound_enabled"] = "false";
      vi.resetModules();
      const { getConfettiSoundEnabled } = await import("@/lib/confetti");
      expect(getConfettiSoundEnabled()).toBe(false);
    });
  });

  describe("setConfettiSoundEnabled", () => {
    it("寫入 'false' 到 localStorage", async () => {
      vi.resetModules();
      const { setConfettiSoundEnabled } = await import("@/lib/confetti");
      setConfettiSoundEnabled(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "taskflow_confetti_sound_enabled",
        "false",
      );
    });

    it("window 不存在時不拋錯（SSR safe）", async () => {
      vi.stubGlobal("window", undefined);
      vi.resetModules();
      const { setConfettiSoundEnabled } = await import("@/lib/confetti");
      expect(() => setConfettiSoundEnabled(false)).not.toThrow();
    });
  });
});
