/**
 * webhook.test.ts — useWebhook module smoke tests
 *
 * 覆蓋: getWebhookUrl / setWebhookUrl / triggerWebhook
 *
 * §8 資安: URL 存 localStorage,失敗靜默吞掉
 * §26-C 已知行為: fetch(url, {mode:'no-cors'}) 在 no-cors 模式下
 * 請求仍會發出但 response 不可讀,這是預期行為(符合 Zapier webhook 需求)。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared mock store
const mockStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStore[key]; }),
  clear: vi.fn(() => { Object.keys(mockStore).forEach(k => delete mockStore[k]); }),
};

describe("getWebhookUrl", () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  it("無 storage 值時回傳 null", async () => {
    vi.resetModules();
    const { getWebhookUrl } = await import("@/lib/useWebhook");
    expect(getWebhookUrl()).toBeNull();
  });

  it("有 storage 值時回傳該 URL", async () => {
    mockStore["taskflow_webhook_url"] = "https://hooks.zapier.com/test";
    vi.resetModules();
    const { getWebhookUrl } = await import("@/lib/useWebhook");
    expect(getWebhookUrl()).toBe("https://hooks.zapier.com/test");
  });

  it("window 不存在時回傳 null（SSR safe）", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    const { getWebhookUrl } = await import("@/lib/useWebhook");
    expect(getWebhookUrl()).toBeNull();
  });
});

describe("setWebhookUrl", () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  it("寫入有效 URL", async () => {
    vi.resetModules();
    const { setWebhookUrl } = await import("@/lib/useWebhook");
    setWebhookUrl("https://hooks.zapier.com/hooks/catch/123");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "taskflow_webhook_url",
      "https://hooks.zapier.com/hooks/catch/123",
    );
  });

  it("空白字串觸發 removeItem", async () => {
    vi.resetModules();
    const { setWebhookUrl } = await import("@/lib/useWebhook");
    setWebhookUrl("");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("taskflow_webhook_url");
  });

  it("null 觸發 removeItem", async () => {
    vi.resetModules();
    const { setWebhookUrl } = await import("@/lib/useWebhook");
    setWebhookUrl(null);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("taskflow_webhook_url");
  });

  it("自動 trim URL", async () => {
    vi.resetModules();
    const { setWebhookUrl } = await import("@/lib/useWebhook");
    setWebhookUrl("  https://example.com/hook  ");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "taskflow_webhook_url",
      "https://example.com/hook",
    );
  });

  it("window 不存在時不拋錯（SSR safe）", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    const { setWebhookUrl } = await import("@/lib/useWebhook");
    expect(() => setWebhookUrl("https://example.com")).not.toThrow();
  });
});

describe("triggerWebhook", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let setTimeoutMock: ReturnType<typeof vi.fn>;
  let clearTimeoutMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    vi.clearAllMocks();

    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    setTimeoutMock = vi.fn((cb: () => void) => { cb(); return 0; });
    clearTimeoutMock = vi.fn();
    vi.stubGlobal("setTimeout", setTimeoutMock);
    vi.stubGlobal("clearTimeout", clearTimeoutMock);

    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  it("未設定 URL 時不發 fetch", async () => {
    vi.resetModules();
    const { triggerWebhook } = await import("@/lib/useWebhook");
    triggerWebhook({
      timestamp: "2026-08-16T00:00:00.000Z",
      event: "batch",
      source: "user_test",
      data: { hello: "world" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("已設定 URL 時發 fetch", async () => {
    mockStore["taskflow_webhook_url"] = "https://hooks.zapier.com/test";
    vi.resetModules();
    const { triggerWebhook } = await import("@/lib/useWebhook");
    triggerWebhook({
      timestamp: "2026-08-16T00:00:00.000Z",
      event: "task.created",
      source: "user_1",
      data: { id: "task-1", title: "Test" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetch payload 格式正確（mode:no-cors, JSON body）", async () => {
    mockStore["taskflow_webhook_url"] = "https://hooks.zapier.com/test";
    vi.resetModules();
    const { triggerWebhook } = await import("@/lib/useWebhook");
    triggerWebhook({
      timestamp: "2026-08-16T00:00:00.000Z",
      event: "batch",
      source: "user_test",
      data: { hello: "world" },
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.zapier.com/test");
    expect(opts.method).toBe("POST");
    expect(opts.mode).toBe("no-cors");
    expect(opts.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse((opts.body as string));
    expect(body.event).toBe("batch");
    expect(body.source).toBe("user_test");
    expect(body.data.hello).toBe("world");
  });
});
