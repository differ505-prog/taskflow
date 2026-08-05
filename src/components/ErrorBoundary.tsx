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
        <div className="fixed inset-0 z-[9999] bg-red-50 p-4 overflow-y-auto">
          <h1 className="text-xl font-bold text-red-600 mb-4">Something went wrong.</h1>
          <p className="text-sm font-mono text-red-800 bg-red-100 p-2 rounded whitespace-pre-wrap">
            {this.state.error?.toString()}
          </p>
          <pre className="mt-4 text-xs font-mono text-red-600 bg-red-50 p-2 border border-red-200 overflow-x-auto whitespace-pre-wrap">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
