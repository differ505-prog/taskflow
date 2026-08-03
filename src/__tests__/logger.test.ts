import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "@/lib/logger";

/**
 * §可觀測性 quick win:structure logger 行為
 *
 * 設計動機:這 5 個 method 是 4 個 sync 檔替換後的合約。
 * 一旦未來 logger 內部改動(接 Sentry / PostHog),所有 sync 檔的行為都依此合約。
 *
 * 測試目標:
 * 1. ns() 回傳物件, 4 個 method 存在
 * 2. dev 模式:人類可讀 console 輸出
 * 3. prod 模式:JSON.stringify 結構化輸出
 * 4. payload 正確序列化
 * 5. 多個 ns 隔離(不會互相汙染)
 */
describe("logger (結構化輸出 wrapper)", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("ns() factory", () => {
    it("回傳物件,含 info/warn/error 三個 method", () => {
      const log = logger.ns("test");
      expect(typeof log.info).toBe("function");
      expect(typeof log.warn).toBe("function");
      expect(typeof log.error).toBe("function");
    });

    it("每個 ns 獨立,呼叫 log X 不會污染 log Y", () => {
      const logA = logger.ns("namespaceA");
      const logB = logger.ns("namespaceB");
      logA.info("hello");
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0];
      expect(call[0]).toContain("namespaceA");
      expect(call[0]).not.toContain("namespaceB");
    });
  });

  describe("dev 模式 (NODE_ENV !== 'production')", () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("info(message) → console.log called with [namespace] message", () => {
      const log = logger.ns("devTest");
      log.info("hello world");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toBe("[devTest] hello world");
    });

    it("info(message, payload) → console.log called with [namespace] message + payload", () => {
      const log = logger.ns("devTest");
      log.info("user signup", { userId: "u-123", plan: "pro" });
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toBe("[devTest] user signup");
      expect(logSpy.mock.calls[0][1]).toEqual({ userId: "u-123", plan: "pro" });
    });

    it("warn() → console.warn (not console.log)", () => {
      const log = logger.ns("devTest");
      log.warn("deprecated API");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("error() → console.error (not console.log)", () => {
      const log = logger.ns("devTest");
      log.error("sync failed");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("空 payload → 只輸出 message,不附 payload", () => {
      const log = logger.ns("devTest");
      log.info("simple", {});
      expect(logSpy.mock.calls[0][1]).toBeUndefined();
    });
  });

  describe("prod 模式 (NODE_ENV === 'production')", () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("info(message) → console.log called with JSON.stringify { level, ns, message, ts }", () => {
      const log = logger.ns("prodTest");
      log.info("sync start");
      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("info");
      expect(parsed.ns).toBe("prodTest");
      expect(parsed.message).toBe("sync start");
      expect(typeof parsed.ts).toBe("number");
    });

    it("info(message, payload) → payload 結構化合併進 JSON", () => {
      const log = logger.ns("prodTest");
      log.info("user action", { userId: "u-456", action: "tap" });
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.userId).toBe("u-456");
      expect(parsed.action).toBe("tap");
      expect(parsed.level).toBe("info");
    });

    it("warn() → console.warn with JSON", () => {
      const log = logger.ns("prodTest");
      log.warn("retry");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("warn");
    });

    it("error() → console.error with JSON", () => {
      const log = logger.ns("prodTest");
      log.error("crash", { code: "ECONNREFUSED" });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("error");
      expect(parsed.code).toBe("ECONNREFUSED");
    });
  });
});
