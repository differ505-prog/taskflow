"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import type { Task } from "@/lib/types";

interface GlobalSearchBarProps {
  className?: string;
  onSelectTask?: (id: string) => void;
  /** 切換到含此 task 的 view(e.g. "list")並設定 listId;可選 — 用於搜尋結果想順便跳清單時 */
  onNavigateToTask?: (task: Task) => void;
}

const MAX_RESULTS = 10;

/**
 * 全視圖共用的搜尋列 — 從 AppShell toolbar 抽出
 * 所有 view(包括 calendar / habits / tags / stats)都能用同一個 searchQuery state
 * 因為 searchQuery 本來就在 useApp() 裡是 global
 *
 * 搜尋期間 input 下方會展開 dropdown 浮層,列出符合的任務 + 點擊跳轉 detail panel
 */
export function GlobalSearchBar({ className = "", onSelectTask, onNavigateToTask }: GlobalSearchBarProps) {
  const { searchQuery, setSearchQuery, getFilteredTasks, tasks, lists } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = searchQuery.trim();
  const hasQuery = trimmed.length > 0;

  // 為什麼這裡不直接呼叫 getFilteredTasks()?
  // 因為 getFilteredTasks() 會受到 currentView/activeFilter 影響,搜尋結果應該是「所有任務中匹配的字」,
  // 不能被當前 view 限制掉(例如在 calendar 搜尋 inbox 的任務,也該跳出來)。
  // 為了 UX 一致性,搜尋 dropdown 顯示「全任務比對」,而當前 view 內的就地過濾仍由 getFilteredTasks 負責。
  const matchedTasks: Task[] = hasQuery
    ? (() => {
        const q = trimmed.toLowerCase();
        return tasks
          .filter((t) => !t.isArchived)
          .filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.description?.toLowerCase().includes(q) ||
              t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
              t.subTasks?.some((s) => s.title.toLowerCase().includes(q))
          )
          .slice(0, MAX_RESULTS);
      })()
    : [];

  const listNameById = new Map(lists.map((l) => [l.id, l]));

  // 點外部 / Esc / 清空輸入 → 收起 dropdown
  useEffect(() => {
    if (!hasQuery) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        inputRef.current?.blur();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setSearchQuery("");
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [hasQuery, setSearchQuery]);

  const handleSelect = (task: Task) => {
    if (onNavigateToTask) onNavigateToTask(task);
    else if (onSelectTask) onSelectTask(task.id);
    setSearchQuery("");
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: "var(--text-tertiary)" }}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter on first result (若 dropdown 顯示) → 開啟它
            if (e.key === "Enter") {
              e.preventDefault();
              if (matchedTasks.length > 0) handleSelect(matchedTasks[0]);
            }
          }}
          placeholder="搜尋任務 / 子任務 / 標籤..."
          aria-label="搜尋任務"
          className="input pl-9 pr-9"
          style={{ fontSize: 13, paddingTop: 7, paddingBottom: 7, width: 220 }}
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            aria-label="清除搜尋"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {hasQuery && (
          <motion.div
            key="search-dropdown"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
            style={{
              width: 360,
              maxHeight: 420,
              background: "var(--surface-elevated)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border)",
            }}
            role="listbox"
            aria-label="搜尋結果"
          >
            {matchedTasks.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  沒有符合「{trimmed}」的任務
                </p>
              </div>
            ) : (
              <>
                <div
                  className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider"
                  style={{
                    color: "var(--text-tertiary)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {matchedTasks.length >= MAX_RESULTS
                    ? `${MAX_RESULTS}+ 個結果(顯示前 ${MAX_RESULTS} 個)`
                    : `${matchedTasks.length} 個結果`}
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
                  {matchedTasks.map((task) => {
                    const list = task.listId ? listNameById.get(task.listId) : null;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleSelect(task)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/5 focus:bg-black/5 focus-visible:outline-none"
                        role="option"
                        aria-selected="false"
                      >
                        {list?.icon && (
                          <span className="text-base flex-shrink-0">{list.icon}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[13px] truncate"
                            style={{
                              color: "var(--text-primary)",
                              textDecoration: task.status === "done" ? "line-through" : "none",
                              opacity: task.status === "done" ? 0.6 : 1,
                            }}
                          >
                            {highlightMatch(task.title, trimmed)}
                          </div>
                          <div
                            className="text-[11px] truncate flex items-center gap-2"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {list && <span>{list.name}</span>}
                            {task.dueDate && (
                              <>
                                {list && <span>·</span>}
                                <span>{task.dueDate}</span>
                              </>
                            )}
                            {task.tags.length > 0 && (
                              <>
                                {(list || task.dueDate) && <span>·</span>}
                                <span className="truncate">
                                  {task.tags.slice(0, 3).join(" ")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 把命中片段用 bold-style span 包起來(用 brand 色)
 * 不用 dangerouslySetInnerHTML — 直接拆字串 + React children
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span style={{ color: "var(--brand)", fontWeight: 600 }}>{match}</span>
      {after}
    </>
  );
}
