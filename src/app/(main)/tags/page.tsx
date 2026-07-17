"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Tags as TagsIcon, Trash2, Edit3, Plus, X, Check, Lock } from "lucide-react";
import { Task } from "@/lib/types";
import { TAG_COLORS } from "@/lib/types";
import { getTasks, saveTasks, getTagColors, saveTagColors, setTagColor, removeTagColor } from "@/lib/storage";
import { useAuth } from "@/lib/AuthContext";
import { useFeatureGate } from "@/lib/useFeatureGate";
import { motion, AnimatePresence } from "framer-motion";

interface TagEntry {
  name: string;
  count: number;
  tasks: Task[];
}

export default function TagsPage() {
  const { isAdmin, isPro, isBeta } = useAuth();
  // 方案 X（向後相容）：beta 用戶繼續享有早期體驗
  const canCustomizeTags = isAdmin || isBeta || isPro;
  // 關聯式標籤更新（PRO 守衛）：free 用戶無法一鍵批次改 tag 名稱
  const renameGate = useFeatureGate("tag-rename");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTasks(getTasks());
    setTagColors(getTagColors());
    setIsLoaded(true);
  }, []);

  // Focus new tag input when modal opens
  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => newTagInputRef.current?.focus(), 50);
    }
  }, [showCreateModal]);

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

  const handleRenameTag = (oldName: string) => {
    // PRO 守衛：free 用戶繞過 UI 直接呼叫時也會被擋下（保險絲）
    if (renameGate.locked) { renameGate.requestUnlock(); return; }
    if (!editInput.trim() || editInput.trim() === oldName) {
      setEditingTag(null);
      return;
    }
    const newName = editInput.trim();
    // 若舊標籤有顏色，且新名稱沒有顏色設定，搬移顏色
    const existingColor = tagColors[oldName];
    if (existingColor && !tagColors[newName]) {
      const newColors = { ...tagColors };
      delete newColors[oldName];
      newColors[newName] = existingColor;
      setTagColors(newColors);
      saveTagColors(newColors);
    }
    const updated = tasks.map((task) => ({
      ...task,
      tags: task.tags.map((t) => (t === oldName ? newName : t)),
      updatedAt: new Date().toISOString(),
    }));
    setTasks(updated);
    saveTasks(updated);
    setEditingTag(null);
  };

  // 建立新標籤（只是建立名稱，不強制附加到任何任務）
  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    // 初始化該標籤的顏色（付費用戶可自選，free 用戶用預設）
    if (!tagColors[name]) {
      const newColors = { ...tagColors, [name]: newTagColor };
      setTagColors(newColors);
      saveTagColors(newColors);
    }
    setShowCreateModal(false);
    setNewTagName("");
    setNewTagColor(TAG_COLORS[0]);
  };

  // 刪除標籤時一併移除顏色設定
  const handleRemoveTag = (tagName: string) => {
    removeTagColor(tagName);
    const newColors = { ...tagColors };
    delete newColors[tagName];
    setTagColors(newColors);
    const updated = tasks.map((task) => ({
      ...task,
      tags: task.tags.filter((t) => t !== tagName),
      updatedAt: new Date().toISOString(),
    }));
    setTasks(updated);
    saveTasks(updated);
  };

  // 變更標籤顏色（僅 admin/beta）
  const handleChangeColor = (tagName: string, color: string) => {
    const newColors = { ...tagColors, [tagName]: color };
    setTagColors(newColors);
    saveTagColors(newColors);
    setShowColorPicker(null);
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
            <div className="flex-1 min-w-0">
              <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">標籤</h1>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {tagEntries.length > 0 ? `${tagEntries.length} 個標籤` : "尚無標籤"}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
              aria-label="新增標籤"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">新增標籤</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* Freemium Hint */}
        {!canCustomizeTags && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[12px]" style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}>
            <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            <span>免費用戶可使用標籤功能；自訂顏色為付費功能</span>
          </div>
        )}

        {/* 新增標籤 Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
            >
              <motion.div
                className="w-full max-w-sm rounded-2xl p-6"
                style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>新增標籤</h2>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl hover:bg-black/5" style={{ color: "var(--text-tertiary)" }} aria-label="關閉">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 標籤名稱 */}
                <div className="mb-4">
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>標籤名稱</label>
                  <input
                    ref={newTagInputRef}
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); if (e.key === "Escape") setShowCreateModal(false); }}
                    placeholder="輸入標籤名稱"
                    className="input w-full"
                    maxLength={50}
                  />
                </div>

                {/* 顏色選擇 */}
                {canCustomizeTags ? (
                  <div className="mb-5">
                    <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>顏色</label>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className="w-8 h-8 rounded-full transition-all duration-150 hover:scale-110"
                          style={{
                            background: color,
                            outline: newTagColor === color ? "2.5px solid var(--text-primary)" : "none",
                            outlineOffset: "2px",
                          }}
                          aria-label={`選擇顏色 ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-5">
                    <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>顏色</label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full" style={{ background: TAG_COLORS[0] }} />
                      <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>預設藍色</span>
                      <span className="ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded-md" style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}>
                        <Lock className="w-3 h-3" />
                        付費
                      </span>
                    </div>
                  </div>
                )}

                {/* 預覽 */}
                {newTagName.trim() && (
                  <div className="mb-5 flex items-center gap-2">
                    <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>預覽</span>
                    <span
                      className="pill text-[12px]"
                    style={{
                      background: canCustomizeTags ? `${newTagColor}20` : "var(--surface-muted)",
                      color: canCustomizeTags ? newTagColor : "var(--text-secondary)",
                      borderColor: canCustomizeTags ? newTagColor : "transparent",
                      border: "1px solid",
                    }}
                    >
                      {newTagName.trim()}
                    </span>
                  </div>
                )}

                {/* 操作 */}
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowCreateModal(false)} className="btn-ghost">取消</button>
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                    className="btn-primary disabled:opacity-40"
                  >
                    <Check className="w-4 h-4 mr-1" aria-hidden="true" />
                    建立
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 標籤列表 */}
        {tagEntries.length === 0 ? (
          <div className="card py-16 text-center">
            <TagsIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            <p className="text-[14px] text-[var(--text-tertiary)]">
              尚無標籤
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              點擊上方「新增標籤」建立第一個標籤
            </p>
          </div>
        ) : (
          <section aria-label="標籤列表">
            <ul className="space-y-2" role="list">
              {tagEntries.map((entry) => {
                const tagColor = tagColors[entry.name] || TAG_COLORS[0];
                const canCustomize = isAdmin || isBeta || isPro;
                return (
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
                              {/* 顏色指示器 */}
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ background: tagColor }}
                                aria-hidden="true"
                              />
                              <span
                                className="pill text-[13px]"
                                style={{
                                  background: `${tagColor}18`,
                                  color: tagColor,
                                  border: `1px solid ${tagColor}30`,
                                }}
                              >
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
                          {/* 顏色按鈕（admin/beta 可見） */}
                          {canCustomize && (
                            <div className="relative">
                              <button
                                onClick={() => setShowColorPicker(showColorPicker === entry.name ? null : entry.name)}
                                className="p-2 rounded-lg transition-all duration-150 active:scale-90"
                                style={{
                                  background: showColorPicker === entry.name ? `${tagColor}20` : "transparent",
                                  color: tagColor,
                                }}
                                aria-label={`選擇顏色 for ${entry.name}`}
                                title="變更顏色"
                              >
                                <div className="w-4 h-4 rounded-full" style={{ background: tagColor }} />
                              </button>
                              <AnimatePresence>
                                {showColorPicker === entry.name && (
                                  <motion.div
                                    className="absolute right-0 top-full mt-1 z-10 p-2 rounded-xl flex gap-1.5"
                                    style={{ background: "var(--surface)", boxShadow: "var(--shadow-md)", border: "1px solid var(--border)" }}
                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                  >
                                    {TAG_COLORS.map((c) => (
                                      <button
                                        key={c}
                                        onClick={() => handleChangeColor(entry.name, c)}
                                        className="w-6 h-6 rounded-full transition-all duration-150 hover:scale-110"
                                        style={{
                                          background: c,
                                          outline: c === tagColor ? "2px solid var(--text-primary)" : "none",
                                          outlineOffset: "1px",
                                        }}
                                        aria-label={`設定顏色 ${c}`}
                                      />
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              if (renameGate.locked) { renameGate.requestUnlock(); return; }
                              setEditingTag(entry.name);
                              setEditInput(entry.name);
                            }}
                            disabled={renameGate.locked}
                            className="p-2 rounded-lg transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:text-[var(--brand)] enabled:hover:bg-[var(--brand-tint)]"
                            style={{ color: "var(--text-tertiary)" }}
                            aria-label={renameGate.locked ? `編輯標籤 ${entry.name}（PRO 專屬）` : `編輯標籤 ${entry.name}`}
                            title={renameGate.locked ? "PRO 專屬：一鍵批次更新所有關聯任務" : undefined}
                          >
                            {renameGate.locked ? (
                              <Lock className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <Edit3 className="w-4 h-4" aria-hidden="true" />
                            )}
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
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
