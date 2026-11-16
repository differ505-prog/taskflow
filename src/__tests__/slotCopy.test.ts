import { describe, it, expect } from "vitest";
import {
  SLOT_EMPTY_COPY,
  SLOT_UNASSIGNED_COPY,
  SLOT_GRID_TITLE,
  SLOT_FOLDED_HINT,
  SLOT_UNFOLDED_HINT,
  SLOT_DURATION_LABEL,
} from "@/lib/slotCopy";

/** 禁用字串：驚嘆號、責備語氣、殘缺的自我否定 */
const FORBIDDEN = [
  "!",
  "！",
  "過期",
  "逾期",
  "未完成",
  "失敗",
  "欠",
  "賴床",
  "空",
  "無安排",
];

const ALL_COPY = [
  SLOT_EMPTY_COPY,
  SLOT_UNASSIGNED_COPY,
  SLOT_GRID_TITLE,
  SLOT_FOLDED_HINT,
  SLOT_UNFOLDED_HINT,
  SLOT_DURATION_LABEL,
];

describe("slotCopy — 節奏槽文案紀律", () => {
  it("所有文案不含禁用字串", () => {
    for (const copy of ALL_COPY) {
      for (const token of FORBIDDEN) {
        expect(copy).not.toContain(token);
      }
    }
  });

  it("空槽文案是邀請而非指控", () => {
    expect(SLOT_EMPTY_COPY).toContain("留給你");
  });

  it("標題說明這是一天的節奏", () => {
    expect(SLOT_GRID_TITLE).toContain("一天的節奏");
  });
});
