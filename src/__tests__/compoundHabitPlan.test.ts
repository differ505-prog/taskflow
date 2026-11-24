import { describe, it, expect } from "vitest";
import type { Habit } from "@/lib/types";
import {
  COMPOUND_HABIT_TEMPLATES,
  COMPOUND_PLAN,
  buildReflectionNote,
  canActivateCompoundExperiment,
  getActiveCompoundExperiment,
  isReflectionHabit,
  parseReflectionNote,
} from "@/lib/compoundHabitPlan";
import { archivePlanHabits } from "@/lib/sourcePlan";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    title: "Test Habit",
    frequency: "daily",
    targetCount: 1,
    color: "#4F6AF5",
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    checkins: [],
    streak: 0,
    longestStreak: 0,
    ...overrides,
  };
}

describe("compoundHabitPlan — 1-Slot 閥門", () => {
  it("沒有進行中實驗時允許開啟", () => {
    const result = canActivateCompoundExperiment([
      makeHabit({ id: "manual" }),
      makeHabit({ id: "archived", archivedAt: "2026-11-13T00:00:00.000Z", sourcePlan: COMPOUND_PLAN }),
    ]);
    expect(result.allowed).toBe(true);
    expect(result.activeHabit).toBeNull();
  });

  it("已有未封存的複利實驗時禁止再開新，並帶出該實驗", () => {
    const active = makeHabit({ id: "active", title: "睡前 100 字決策復盤 ＋ 一句真話", sourcePlan: COMPOUND_PLAN });
    const result = canActivateCompoundExperiment([
      makeHabit({ id: "manual" }),
      active,
    ]);
    expect(result.allowed).toBe(false);
    expect(result.activeHabit?.id).toBe("active");
    expect(getActiveCompoundExperiment([active])?.id).toBe("active");
  });

  it("封存後恢復可開啟", () => {
    const nowIso = "2026-11-13T12:20:00.000Z";
    const habits = [makeHabit({ id: "active", sourcePlan: COMPOUND_PLAN })];

    const { nextHabits } = archivePlanHabits(habits, COMPOUND_PLAN.id, nowIso);
    expect(nextHabits[0].archivedAt).toBe(nowIso);
    // 打卡紀錄仍保留
    expect(nextHabits[0].checkins).toHaveLength(0);

    const result = canActivateCompoundExperiment(nextHabits);
    expect(result.allowed).toBe(true);
    expect(result.activeHabit).toBeNull();
  });

  it("整套退場後可重新開啟新的實驗", () => {
    const nowIso = "2026-11-13T12:20:00.000Z";
    const habits = [
      makeHabit({
        id: "active",
        sourcePlan: COMPOUND_PLAN,
        checkins: [{ date: "2026-11-13", completed: true, count: 1 }],
      }),
    ];
    const { nextHabits } = archivePlanHabits(habits, COMPOUND_PLAN.id, nowIso);
    expect(canActivateCompoundExperiment(nextHabits).allowed).toBe(true);
    expect(nextHabits[0].checkins).toHaveLength(1);
  });
});

describe("compoundHabitPlan — 復盤筆記 round-trip", () => {
  it("buildReflectionNote 過濾空白欄位", () => {
    const note = buildReflectionNote({
      decision: "  接下這個案子  ",
      outcome: "",
      nextStep: "   ",
      hardTruth: "我在迴避真正的難題",
    });
    expect(note).toBe("決定：接下這個案子\n真話：我在迴避真正的難題");
  });

  it("全部空白時回傳空字串", () => {
    expect(buildReflectionNote({ decision: "", outcome: "", nextStep: "" })).toBe("");
  });

  it("parseReflectionNote 支援空值與 undefined", () => {
    const parsed = parseReflectionNote(undefined);
    expect(parsed).toEqual({ decision: "", outcome: "", nextStep: "", hardTruth: "" });
    expect(parseReflectionNote("   ")).toEqual({
      decision: "",
      outcome: "",
      nextStep: "",
      hardTruth: "",
    });
  });

  it("build → parse 可完整還原四個欄位", () => {
    const fields = {
      decision: "決定自己寫產品",
      outcome: "第一版上線了",
      nextStep: "明天先修登入流程",
      hardTruth: "我其實很怕被看到不完美的東西",
    };
    const parsed = parseReflectionNote(buildReflectionNote(fields));
    expect(parsed).toEqual(fields);
  });

  it("容忍非標準行：無標籤的行併入「決定」", () => {
    const parsed = parseReflectionNote("今天想到一件重要的事\n結果：順利");
    expect(parsed.decision).toBe("今天想到一件重要的事");
    expect(parsed.outcome).toBe("順利");
  });
});

describe("compoundHabitPlan — 範本與複盤對象判定", () => {
  it("提供 4 個精選實驗且欄位完整", () => {
    expect(COMPOUND_HABIT_TEMPLATES).toHaveLength(4);
    for (const t of COMPOUND_HABIT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.frequency === "daily" || t.frequency === "weekly").toBe(true);
      expect(t.pomodoroMinutes).toBeGreaterThan(0);
      expect(t.dailyTargetMinutes).toBeGreaterThanOrEqual(0);
      expect(t.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.discomfortHint).toBeTruthy();
    }
  });

  it("isReflectionHabit 判定標題含復盤或屬於方案", () => {
    expect(isReflectionHabit(makeHabit({ title: "睡前 100 字決策復盤" }))).toBe(true);
    expect(isReflectionHabit(makeHabit({ title: "喝水", sourcePlan: COMPOUND_PLAN }))).toBe(true);
    expect(isReflectionHabit(makeHabit({ title: "喝水" }))).toBe(false);
    expect(isReflectionHabit(makeHabit({ title: "復盤", archivedAt: "x" }))).toBe(false);
  });
});
