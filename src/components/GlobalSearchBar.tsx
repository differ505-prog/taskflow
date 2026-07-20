"use client";

import { Search } from "lucide-react";
import { useApp } from "@/lib/AppContext";

interface GlobalSearchBarProps {
  className?: string;
}

/**
 * 全視圖共用的搜尋列 — 從 AppShell toolbar 抽出
 * 所有 view(包括 calendar / habits / tags / stats)都能用同一個 searchQuery state
 * 因為 searchQuery 本來就在 useApp() 裡是 global
 */
export function GlobalSearchBar({ className = "" }: GlobalSearchBarProps) {
  const { searchQuery, setSearchQuery } = useApp();
  return (
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style={{ color: "var(--text-tertiary)" }}
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder="搜尋任務 / 子任務 / 標籤..."
        aria-label="搜尋任務"
        className="input pl-9 pr-4"
        style={{ fontSize: 13, paddingTop: 7, paddingBottom: 7, width: 220 }}
      />
    </div>
  );
}
