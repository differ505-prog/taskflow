// Haptic feedback utility
// Uses the Vibration API to provide tactile feedback on mobile devices

export type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: 32,
  success: [8, 50, 16],
  warning: [16, 50, 8, 50, 16],
  error: [32, 50, 16, 50, 32, 50, 16],
  selection: 4,
};

export function canHapt(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function haptic(type: HapticType = "light"): void {
  if (!canHapt()) return;
  try {
    const pattern = HAPTIC_PATTERNS[type];
    navigator.vibrate(pattern);
  } catch {
    // Silently fail — haptic not supported
  }
}

export function hapticOnce(type: HapticType = "light"): void {
  haptic(type);
  // Cancel after one cycle for "once" calls
  if (canHapt()) {
    setTimeout(() => {
      try { navigator.vibrate(0); } catch { /* ignore */ }
    }, 200);
  }
}
