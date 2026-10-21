import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFlowTimer, type FlowTimerSnapshot } from "@/lib/usePomodoro";

/**
 * §番茄計數入帳回歸測試
 *
 * 歷史 bug：startTicker 的 setInterval 回呼透過 React state 讀取 boundHabitId，
 * 抓到的是「interval 建立當下」的快照。start() 內的 setBoundHabitId 是非同步
 * 更新，回呼永遠讀到 undefined → HabitPomodoroBridge 直接略過寫入，
 * 習慣的當日番茄數永遠 +0。
 *
 * 修法：計時器內部真相一律放 ref，state 僅供渲染。
 */

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Harness = {
  controller: ReturnType<typeof useFlowTimer>;
  snapshots: FlowTimerSnapshot[];
};

function mountTimer(): { harness: Harness; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  const harness: Harness = {
    controller: undefined as unknown as Harness["controller"],
    snapshots: [],
  };

  function Probe() {
    const controller = useFlowTimer();
    harness.controller = controller;
    useEffect(() => {
      return controller.onComplete((s) => {
        harness.snapshots.push(s);
      });
    }, [controller]);
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    harness,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useFlowTimer — 習慣番茄綁定入帳", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("focus session 完成時，snapshot 帶有啟動時綁定的 habitId", () => {
    const { harness, unmount } = mountTimer();

    act(() => {
      harness.controller.start({ type: "focus", habitId: "habit-abc", customMinutes: 5 });
    });

    // 推進 5 分鐘 + 觸發 ticker 的 250ms 間隔
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 500);
    });

    expect(harness.snapshots.length).toBe(1);
    expect(harness.snapshots[0].type).toBe("focus");
    expect(harness.snapshots[0].boundHabitId).toBe("habit-abc");
    // totalMs 必須是這場 session 的真實長度（用來換算分鐘數）
    expect(harness.snapshots[0].totalMs).toBe(5 * 60 * 1000);

    unmount();
  });

  it("自訂時長（🍅 5）不會被 config 預設值覆蓋", () => {
    const { harness, unmount } = mountTimer();

    act(() => {
      harness.controller.start({ type: "focus", habitId: "habit-xyz", customMinutes: 10 });
    });
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 500);
    });

    expect(harness.snapshots[0].totalMs).toBe(10 * 60 * 1000);
    expect(harness.snapshots[0].boundHabitId).toBe("habit-xyz");

    unmount();
  });

  it("pause → resume 後完成，仍會帶回原本的 habitId", () => {
    const { harness, unmount } = mountTimer();

    act(() => {
      harness.controller.start({ type: "focus", habitId: "habit-pause", customMinutes: 5 });
    });

    // 跑 2 分鐘後暫停
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    act(() => {
      harness.controller.pause();
    });

    // 恢復並續跑剩下 3 分鐘
    act(() => {
      harness.controller.resume();
    });
    act(() => {
      vi.advanceTimersByTime(3 * 60 * 1000 + 500);
    });

    expect(harness.snapshots.length).toBe(1);
    expect(harness.snapshots[0].boundHabitId).toBe("habit-pause");

    unmount();
  });

  it("沒有綁定習慣的 focus session 不會憑空生出 habitId", () => {
    const { harness, unmount } = mountTimer();

    act(() => {
      harness.controller.start({ type: "focus", customMinutes: 5 });
    });
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 500);
    });

    expect(harness.snapshots.length).toBe(1);
    expect(harness.snapshots[0].boundHabitId).toBeUndefined();

    unmount();
  });

  it("reset 會清除習慣綁定，reset 後的 session 不會誤記到舊習慣", () => {
    const { harness, unmount } = mountTimer();

    act(() => {
      harness.controller.start({ type: "focus", habitId: "habit-old", customMinutes: 5 });
    });
    act(() => {
      harness.controller.reset({ type: "focus" });
    });
    act(() => {
      harness.controller.start({ type: "focus", customMinutes: 5 });
    });
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 500);
    });

    expect(harness.snapshots.length).toBe(1);
    expect(harness.snapshots[0].boundHabitId).toBeUndefined();

    unmount();
  });
});
