"use client";

import { useEffect, useState } from "react";
import { ErrorBoundary as ErrorBoundaryComponent } from "@/components/ErrorBoundary";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-TW">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--surface-muted)]">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: "rgba(255,59,48,0.08)" }}
            aria-hidden="true"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="var(--status-danger)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] mb-2">
            頁面錯誤
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] max-w-xs leading-relaxed mb-8">
            發生非預期錯誤，請重新整理
          </p>
          <button
            onClick={reset}
            className="btn-primary"
          >
            重新整理
          </button>
        </div>
      </body>
    </html>
  );
}
