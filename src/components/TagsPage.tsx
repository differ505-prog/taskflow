"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { Tags as TagsIcon, Plus, Trash2, Edit3 } from "lucide-react";
import { motion } from "framer-motion";

export function TagsPage() {
  const { tasks, updateTask } = useApp();
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");

  useEffect(() => { setIsLoaded(true); }, []);

  const tagEntries = (() => {
    const map = new Map<string, { count: number; tasks: typeof tasks }>();
    tasks.filter((t) => !t.isArchived).forEach((task) => {
      task.tags.forEach((tag) => {
        const existing = map.get(tag);
        if (existing) {
          existing.count++;
          existing.tasks.push(task);
        } else {
          map.set(tag, { count: 1, tasks: [task] });
        }
      });
    });
    return Array.from(map.entries())
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);
  })();

  const handleRename = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName.trim()) { setEditingTag(null); return; }
    tasks.forEach((task) => {
      if (task.tags.includes(oldName)) {
        const newTags = task.tags.map((t) => t === oldName ? newName.trim() : t);
        updateTask(task.id, { tags: newTags });
      }
    });
    setEditingTag(null);
  };

  const handleRemoveTag = (tagName: string) => {
    tasks.forEach((task) => {
      if (task.tags.includes(tagName)) {
        updateTask(task.id, { tags: task.tags.filter((t) => t !== tagName) });
      }
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" role="status" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
          <TagsIcon className="w-5 h-5" style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>標籤管理</h1>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {tagEntries.length > 0 ? `${tagEntries.length} 個標籤` : "尚無標籤"}
          </p>
        </div>
      </div>

      {/* List */}
      {tagEntries.length === 0 ? (
        <div className="card py-16 text-center">
          <TagsIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>尚無標籤</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>在任務中加入標籤即可自動建立</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tagEntries.map((entry) => (
            <motion.div
              key={entry.name}
              className="card px-5 py-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              layout
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {editingTag === entry.name ? (
                    <input
                      type="text"
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(entry.name, editInput);
                        if (e.key === "Escape") setEditingTag(null);
                      }}
                      onBlur={() => handleRename(entry.name, editInput)}
                      className="input w-full max-w-[200px]"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="pill">{entry.name}</span>
                      <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {entry.count} 項任務
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditingTag(entry.name); setEditInput(entry.name); }}
                    className="p-2 rounded-xl hover:bg-black/5 transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label={`編輯標籤 ${entry.name}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveTag(entry.name)}
                    className="p-2 rounded-xl hover:bg-red-50 transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label={`刪除標籤 ${entry.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
