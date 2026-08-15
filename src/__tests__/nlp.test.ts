/**
 * nlp.test.ts — parseNaturalLanguage smoke tests
 */
import { describe, it, expect } from "vitest";
import { parseNaturalLanguage } from "@/lib/nlp";

describe("parseNaturalLanguage — 優先度解析", () => {
  it("p0 設為 do-now", () => {
    const result = parseNaturalLanguage("p0 緊急報告");
    expect(result.priority).toBe("do-now");
  });

  it("p1 設為 schedule", () => {
    const result = parseNaturalLanguage("p1 客戶來信");
    expect(result.priority).toBe("schedule");
  });

  it("p2 設為 delegate", () => {
    const result = parseNaturalLanguage("p2 回信");
    expect(result.priority).toBe("delegate");
  });

  it("p3 設為 none", () => {
    const result = parseNaturalLanguage("p3 整理資料");
    expect(result.priority).toBe("none");
  });

  it("「非常重要」設為 do-now", () => {
    const result = parseNaturalLanguage("非常重要 報告");
    expect(result.priority).toBe("do-now");
  });

  it("任意輸入不拋錯", () => {
    expect(() => parseNaturalLanguage("優先中高 工作")).not.toThrow();
  });
});

describe("parseNaturalLanguage — 日期解析", () => {
  it("「今天」解析", () => {
    const result = parseNaturalLanguage("買牛奶 今天");
    expect(result.dueDate).toBeDefined();
    expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("「明天」解析", () => {
    const result = parseNaturalLanguage("開會 明天");
    expect(result.dueDate).toBeDefined();
    expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("日期與優先度同時存在時兩者都解析", () => {
    const result = parseNaturalLanguage("p1 報告 明天");
    expect(result.priority).toBe("schedule");
    expect(result.dueDate).toBeDefined();
  });
});

describe("parseNaturalLanguage — 標籤解析", () => {
  it("#工作 解析為標籤", () => {
    const result = parseNaturalLanguage("回信 #工作");
    expect(result.tags).toContain("工作");
  });

  it("多個 # 標籤全部解析", () => {
    const result = parseNaturalLanguage("會議 #會議 #上午 #優先");
    expect(result.tags).toContain("會議");
    expect(result.tags).toContain("上午");
    expect(result.tags).toContain("優先");
  });
});

describe("parseNaturalLanguage — 組合輸入", () => {
  it("優先度 + 日期 + 標籤 + 標題 同時存在", () => {
    const result = parseNaturalLanguage("p0 報告 明天 #工作");
    expect(result.priority).toBe("do-now");
    expect(result.dueDate).toBeDefined();
    expect(result.tags).toContain("工作");
    expect(result.title).toMatch(/報告/);
  });

  it("空字串不拋錯，回傳帶空標題", () => {
    const result = parseNaturalLanguage("");
    expect(result.title).toBe("");
  });
});
