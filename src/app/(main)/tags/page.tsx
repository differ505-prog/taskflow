"use client";

import { useEffect, useState, useMemo } from "react";
import { Tags as TagsIcon, Trash2, Edit3 } from "lucide-react";
import { Task } from "@/lib/types";
import { getTasks, saveTasks } from "@/lib/storage";
import { motion } from "framer-motion";

interface TagEntry {
  name: string;
  count: number;
  tasks: Task[];
}

export default function TagsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");

  useEffect(() => {
    setTasks(getTasks());
    setIsLoaded(true);
  }, []);

  const tagEntries = useMemo<TagEntry[]>(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      task.tags.forEach((tag) => {
        const existing = map.get(tag) ?? [];
        map.set(tag, [...existing, task]);
      });
    });
    return Array.from(map.entries())
      .map(([name, tagTasks]) => ({ name, count: tagTasks.length, tasks: tagTasks }))
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  const handleRemoveTag = (tagName: string) => {
    const updated = tasks.map((task) => ({
      ...task,
      tags: task.tags.filter((t) => t !== tagName),
      updatedAt: new Date().toISOString(),
    }));
    setTasks(updated);
    saveTasks(updated);
  };

  const handleRenameTag = (oldName: string) => {
    if (!editInput.trim() || editInput.trim() === oldName) {
      setEditingTag(null);
      return;
    }
    const updated = tasks.map((task) => ({
      ...task,
      tags: task.tags.map((t) => (t === oldName ? editInput.trim() : t)),
      updatedAt: new Date().toISOString(),
    }));
    setTasks(updated);
    saveTasks(updated);
    setEditingTag(null);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" role="status" aria-label="載入中" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
              <TagsIcon className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">標籤</h1>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {tagEntries.length > 0 ? `${tagEntries.length} 個標籤` : "尚無標籤"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* 標籤列表 */}
        {tagEntries.length === 0 ? (
          <div className="card py-16 text-center">
            <TagsIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            <p className="text-[14px] text-[var(--text-tertiary)]">
              尚無標籤
            </p>
          </div>
        ) : (
          <section aria-label="標籤列表">
            <ul className="space-y-2" role="list">
              {tagEntries.map((entry) => (
                <li key={entry.name}>
                  <motion.div
                    className="card px-5 py-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    layout
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* 標籤名稱 / 編輯模式 */}
                      <div className="flex-1 min-w-0">
                        {editingTag === entry.name ? (
                          <input
                            type="text"
                            value={editInput}
                            onChange={(e) => setEditInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameTag(entry.name);
                              if (e.key === "Escape") setEditingTag(null);
                            }}
                            onBlur={() => handleRenameTag(entry.name)}
                            className="input w-full max-w-[200px]"
                            aria-label={`編輯標籤名稱: ${entry.name}`}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="pill">
                              {entry.name}
                            </span>
                            <span className="text-[12px] text-[var(--text-tertiary)]">
                              {entry.count} 項任務
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 任務預覽 */}
                      <div className="hidden md:flex items-center gap-1 overflow-hidden flex-1 min-w-0">
                        {entry.tasks.slice(0, 3).map((task) => (
                          <span
                            key={task.id}
                            className="truncate text-[12px] text-[var(--text-tertiary)] flex-shrink-0 max-w-[120px]"
                            title={task.title}
                          >
                            {task.title}
                            {task !== entry.tasks[Math.min(2, entry.tasks.length - 1)] && ","}
                          </span>
                        ))}
                        {entry.count > 3 && (
                          <span className="text-[12px] text-[var(--text-tertiary)] flex-shrink-0">
                            +{entry.count - 3}
                          </span>
                        )}
                      </div>

                      {/* 操作按鈕 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingTag(entry.name);
                            setEditInput(entry.name);
                          }}
                          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--brand)] hover:bg-[var(--brand-tint)] transition-all duration-150 active:scale-90"
                          aria-label={`編輯標籤 ${entry.name}`}
                        >
                          <Edit3 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleRemoveTag(entry.name)}
                          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--status-danger)] hover:bg-red-50 transition-all duration-150 active:scale-90"
                          aria-label={`刪除標籤 ${entry.name}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
