export interface OutputTarget {
  count: number;
  unit: string;
}

export interface OutputProgress {
  done: number;
  target: number;
  unit: string;
  pct: number;
}

/** Increment an optional output counter by 1. */
export function incrementOutputCount(n: number | undefined): number {
  return (n ?? 0) + 1;
}

/** Compute output progress relative to an optional target; returns null when no target is set. */
export function outputProgress(
  count: number | undefined,
  target?: OutputTarget
): OutputProgress | null {
  if (!target || target.count <= 0) return null;
  const done = Math.max(0, count ?? 0);
  const pct = (done / target.count) * 100;
  return {
    done,
    target: target.count,
    unit: target.unit,
    pct,
  };
}

/** Format output counter as "done/target unit", or "" when no target is set. */
export function formatOutputLabel(
  count: number | undefined,
  target?: OutputTarget
): string {
  const progress = outputProgress(count, target);
  if (!progress) return "";
  return `${progress.done}/${progress.target} ${progress.unit}`.trim();
}
