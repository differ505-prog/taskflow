/**
 * 結構化 logger wrapper(§可觀測性 quick win)
 *
 * 設計動機:
 * - Sync 層 60+ 個 console.log 散落,production 抓瞎
 * - 不引入重型依賴(Pino / Winston)以避免 bundle size 與設定成本
 * - 提供統一 namespace + 等級 + 結構化 payload 介面
 * - dev:直接 console;prod:接 console(未來可換 Sentry / PostHog)
 *
 * 用法:
 *   import { logger } from "@/lib/logger";
 *   const log = logger.ns("personalTaskSync");
 *   log.info("loadTasks start");
 *   log.error("saveTask failed", { id, error });
 *
 * 設計約束(§13 最小變更):
 * - API 與 console 一一對應(info/warn/error)
 * - 沒有 debug 等級(避免在 production 留 trace)
 * - ns() 返回的 logger 是閉包,效能 < 1µs/call
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogPayload {
  [key: string]: unknown;
}

export interface NamespacedLogger {
  info: (message: string, payload?: LogPayload) => void;
  warn: (message: string, payload?: LogPayload) => void;
  error: (message: string, payload?: LogPayload) => void;
}

const isProd = process.env.NODE_ENV === "production";

function emit(level: LogLevel, namespace: string, message: string, payload?: LogPayload): void {
  if (payload && Object.keys(payload).length > 0) {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    if (isProd) {
      // Prod 結構化輸出,未來可換 Sentry.addBreadcrumb 等
      fn(JSON.stringify({ level, ns: namespace, message, ...payload, ts: Date.now() }));
    } else {
      // Dev 維持可讀性
      fn(`[${namespace}] ${message}`, payload);
    }
    return;
  }
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (isProd) {
    fn(JSON.stringify({ level, ns: namespace, message, ts: Date.now() }));
  } else {
    fn(`[${namespace}] ${message}`);
  }
}

export const logger = {
  /**
   * 建立 namespace logger(每個模組一個 ns,方便 grep 與未來 routing)
   */
  ns(namespace: string): NamespacedLogger {
    return {
      info: (message, payload) => emit("info", namespace, message, payload),
      warn: (message, payload) => emit("warn", namespace, message, payload),
      error: (message, payload) => emit("error", namespace, message, payload),
    };
  },
};
