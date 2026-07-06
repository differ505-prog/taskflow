"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--surface-muted)]">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(255,59,48,0.08)" }}>
            <AlertTriangle className="w-8 h-8" style={{ color: "var(--status-danger)" }} aria-hidden="true" />
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] mb-2">
            頁面錯誤
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] max-w-xs leading-relaxed mb-8">
            發生非預期錯誤，請重新整理
          </p>
          <button
            onClick={this.handleReset}
            className="btn-primary"
            aria-label="重新整理"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            重新整理
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
