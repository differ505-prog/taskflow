"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { confirmCopy, type ConfirmCopyKey } from "@/lib/confirmCopy";

export type ConfirmTone = "danger" | "warning" | "info";

export interface ConfirmOptions {
  title: string;
  message: string;
  impactDetail?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  /**
   * 語意意圖：自動套用 VOICE_AND_TONE.md §4 動詞庫
   * - delete  → 永久刪除 / 先不要
   * - remove  → 拿掉 / 先不要
   * - dismiss → 無罪赦免 / 先不要（LostAndFound 風格）
   * - defer   → 放下 / 先不要
   * - replace → 改為 / 先不要
   * - signOut → 登出 / 先不要
   * - leave   → 離開這裡 / 留下
   * - default → 好，下一步 / 先不要
   *
   * 當 intent 與 confirmText/cancelText 同時給定，confirmText/cancelText 優先。
   */
  intent?: ConfirmCopyKey;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

interface ConfirmContextValue {
  confirm: ConfirmFn;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback<ConfirmFn>((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      // 自動套用動詞庫（intent 優先於 tone 預設）
      const intentCopy = opts.intent ? confirmCopy[opts.intent] : null;
      const finalConfirmText = opts.confirmText ?? intentCopy?.confirmText;
      const finalCancelText = opts.cancelText ?? intentCopy?.cancelText;
      setRequest({
        ...opts,
        confirmText: finalConfirmText,
        cancelText: finalCancelText,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    setRequest((prev) => {
      if (prev) prev.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && (
        <ConfirmDialog
          isOpen={true}
          title={request.title}
          message={request.message}
          impactDetail={request.impactDetail}
          confirmText={request.confirmText}
          cancelText={request.cancelText}
          tone={request.tone}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within <ConfirmProvider>");
  }
  return ctx.confirm;
}
