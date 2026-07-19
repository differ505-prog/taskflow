/**
 * useDebouncedField — 詳情面板「輸入即儲存」用 debounce hook
 *
 * 設計目標：
 * - onChange 即時更新本地 React state（即時回饋）
 * - 300ms 後 debounced trigger 寫入（避免每鍵 1 次 DB 寫入）
 * - 元件 unmount 時 flush 最後一次值（避免最後幾字沒存到）
 *
 * 沿用既有 pattern（§25）：
 * - 寫入由外部傳入的 onCommit 觸發（呼叫 AppContext.updateTask）
 * - AppContext 內已有 markRecentlyWritten 5 秒保護窗（§26 類別 A 防護）
 * - 本 hook 不重寫防護邏輯，僅負責 debounce
 */

import { useEffect, useRef } from "react";

export interface UseDebouncedFieldOptions<T> {
  /** 外部值（父層 React state） */
  value: T;
  /** debounce 時間（ms），預設 300 */
  delay?: number;
  /** debounced trigger 後呼叫，傳入最新 value */
  onCommit: (value: T) => void;
  /** 強制立刻 flush（例如 onBlur、unmount） */
  flush?: boolean;
}

export function useDebouncedField<T>({
  value,
  delay = 300,
  onCommit,
  flush = false,
}: UseDebouncedFieldOptions<T>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef<T>(value);
  const isUnmountingRef = useRef(false);

  // value 變化 → 重設計時
  useEffect(() => {
    if (isUnmountingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (lastCommittedRef.current !== value) {
        lastCommittedRef.current = value;
        onCommit(value);
      }
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay, onCommit]);

  // flush=true → 立刻觸發
  useEffect(() => {
    if (!flush) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (lastCommittedRef.current !== value) {
      lastCommittedRef.current = value;
      onCommit(value);
    }
  }, [flush, value, onCommit]);

  // unmount → 最後一次 flush（避免最後幾字掉）
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (lastCommittedRef.current !== value) {
        lastCommittedRef.current = value;
        onCommit(value);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
