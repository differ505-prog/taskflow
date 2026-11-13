export const MVD_TARGET_PCT = 20;

export interface MvdProgress {
  total: number;
  done: number;
  pct: number;
  reached: boolean;
}

/** Compute Minimum Viable Day (MVD) completion progress against the 20% threshold. */
export function computeMvdProgress(total: number, done: number): MvdProgress {
  if (total <= 0) {
    return { total: 0, done: 0, pct: 0, reached: false };
  }
  const safeDone = Math.max(0, done);
  const pct = (safeDone / total) * 100;
  return {
    total,
    done: safeDone,
    pct,
    reached: pct >= MVD_TARGET_PCT,
  };
}
