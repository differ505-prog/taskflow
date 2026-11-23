"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: "var(--surface-muted)", color: "var(--text-primary)" }}
          role="alert"
        >
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="space-y-2">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "var(--status-danger-tint)", color: "var(--status-danger)" }}
              >
                畫面發生異常
              </span>
              <h1 className="text-lg font-semibold text-balance">暫時無法顯示這個畫面</h1>
              <p className="text-sm text-pretty" style={{ color: "var(--text-secondary)" }}>
                資料不會遺失，請重新整理頁面；若問題持續發生，可展開下方錯誤資訊回報。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-primary min-h-[44px]"
              >
                重新載入
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="btn-ghost min-h-[44px]"
              >
                嘗試恢復
              </button>
            </div>
            <details className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              <summary className="cursor-pointer py-1">技術錯誤資訊</summary>
              <pre
                className="mt-2 p-3 rounded-md font-mono overflow-x-auto whitespace-pre-wrap"
                style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
              >
                {this.state.error?.toString()}
                {process.env.NODE_ENV !== "production" && this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
