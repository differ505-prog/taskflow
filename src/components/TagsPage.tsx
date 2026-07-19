"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { Tags as TagsIcon, Plus, Trash2, Edit3, X, Check, Lock } from "lucide-react";
import { Task } from "@/lib/types";
import { TAG_COLORS } from "@/lib/types";
import { getTagColors, saveTagColors, getOrphanTags, saveOrphanTags } from "@/lib/storage";
import { useAuth } from "@/lib/AuthContext";
import { useFeatureGate } from "@/lib/useFeatureGate";
import { motion, AnimatePresence } from "framer-motion";
import { UpgradeModal } from "@/components/UpgradeModal";
import { isComposingKey } from "@/utils/imeGuard";

export function TagsPage() {
  const { tasks, updateTask } = useApp();
  const { isAdmin, isPro, isBeta } = useAuth();
  // 方案 X（向後相容）：beta 用戶繼續享有早期體驗，不破壞現狀
  const canCustomizeTags = isAdmin || isBeta || isPro;
  // 關聯式標籤更新（PRO 守衛）：free 用戶無法一鍵批次改 tag 名稱
  const renameGate = useFeatureGate("tag-rename");
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [orphanTags, setOrphanTags] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTagColors(getTagColors());
    setOrphanTags(getOrphanTags());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => newTagInputRef.current?.focus(), 50);
    }
  }, [showCreateModal]);

  const tagEntries = useMemo(() => {
    const map = new Map<string, { count: number; tasks: Task[] }>();
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
    // 將獨立標籤（沒有任務引用）併入列表
    orphanTags.forEach((name) => {
      if (!map.has(name)) {
        map.set(name, { count: 0, tasks: [] });
      }
    });
    return Array.from(map.entries())
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);
  }, [tasks, orphanTags]);

  const handleRename = (oldName: string, newName: string) => {
    // PRO 守衛：free 用戶繞過 UI 直接呼叫時也會被擋下（保險絲）
    if (renameGate.locked) { renameGate.requestUnlock(); return; }
    if (!newName.trim() || oldName === newName.trim()) { setEditingTag(null); return; }
    const newNameClean = newName.trim();
    const existingColor = tagColors[oldName];
    if (existingColor && !tagColors[newNameClean]) {
      const newColors = { ...tagColors };
      delete newColors[oldName];
      newColors[newNameClean] = existingColor;
      setTagColors(newColors);
      saveTagColors(newColors);
    }
    // 更新所有任務內引用
    tasks.forEach((task) => {
      if (task.tags.includes(oldName)) {
        const newTags = task.tags.map((t) => t === oldName ? newNameClean : t);
        updateTask(task.id, { tags: newTags });
      }
    });
    // 更新 orphanTags（如果舊名是獨立標籤）
    if (orphanTags.includes(oldName)) {
      const next = orphanTags.filter((t) => t !== oldName);
      if (!next.includes(newNameClean)) next.push(newNameClean);
      setOrphanTags(next);
      saveOrphanTags(next);
    }
    setEditingTag(null);
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (!tagColors[name]) {
      const newColors = { ...tagColors, [name]: newTagColor };
      setTagColors(newColors);
      saveTagColors(newColors);
    }
    // 加入獨立標籤清單
    if (!orphanTags.includes(name)) {
      const next = [...orphanTags, name];
      setOrphanTags(next);
      saveOrphanTags(next);
    }
    setShowCreateModal(false);
    setNewTagName("");
    setNewTagColor(TAG_COLORS[0]);
  };

  const handleRemoveTag = (tagName: string) => {
    const colors = { ...tagColors };
    delete colors[tagName];
    setTagColors(colors);
    saveTagColors(colors);
    // 從獨立標籤清單移除
    if (orphanTags.includes(tagName)) {
      const next = orphanTags.filter((t) => t !== tagName);
      setOrphanTags(next);
      saveOrphanTags(next);
    }
    // 從所有任務的 tags 陣列移除
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
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--brand-tint)" }}
        >
          <TagsIcon className="w-5 h-5" style={{ color: "var(--brand)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>標籤管理</h1>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {tagEntries.length > 0 ? `${tagEntries.length} 個標籤` : "尚無標籤"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium flex-shrink-0 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
          aria-label="新增標籤"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">新增標籤</span>
        </button>
      </div>

      {/* Freemium Hint */}
      {!canCustomizeTags && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-[12px]"
          style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}
        >
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
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
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-xl hover:bg-black/5"
                  style={{ color: "var(--text-tertiary)" }}
                  aria-label="關閉"
                >
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
                  onKeyDown={(e) => {
                    if (isComposingKey(e)) return;
                    if (e.key === "Enter") handleCreateTag();
                    if (e.key === "Escape") setShowCreateModal(false);
                  }}
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
                    <span
                      className="ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
                      style={{ background: "var(--surface-muted)", color: "var(--text-tertiary)" }}
                    >
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

      {/* List */}
      {tagEntries.length === 0 ? (
        <div className="card py-16 text-center">
          <TagsIcon className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>尚無標籤</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>點擊上方「新增標籤」建立第一個標籤</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tagEntries.map((entry) => {
            const tagColor = tagColors[entry.name] || TAG_COLORS[0];
            return (
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
                          if (isComposingKey(e)) return;
                          if (e.key === "Enter") handleRename(entry.name, editInput);
                          if (e.key === "Escape") setEditingTag(null);
                        }}
                        onBlur={() => handleRename(entry.name, editInput)}
                        className="input w-full max-w-[200px]"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="pill flex-shrink-0"
                          style={{
                            background: `${tagColor}20`,
                            color: tagColor,
                            borderColor: tagColor,
                          }}
                        >
                          {entry.name}
                        </span>
                        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          {entry.count > 0 ? `${entry.count} 項任務` : "未使用"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        if (renameGate.locked) { renameGate.requestUnlock(); return; }
                        setEditingTag(entry.name); setEditInput(entry.name);
                      }}
                      disabled={renameGate.locked}
                      className="p-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-black/5"
                      style={{ color: renameGate.locked ? "var(--text-tertiary)" : "var(--text-tertiary)" }}
                      aria-label={renameGate.locked ? `編輯標籤 ${entry.name}（PRO 專屬）` : `編輯標籤 ${entry.name}`}
                      title={renameGate.locked ? "PRO 專屬：一鍵批次更新所有關聯任務" : undefined}
                    >
                      {renameGate.locked ? (
                        <Lock className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Edit3 className="w-4 h-4" />
                      )}
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
            );
          })}
        </div>
      )}

      {/* PRO 升級 Modal（本地 state 由 useFeatureGate 管理） */}
      <UpgradeModal
        isOpen={renameGate.upgradeModalOpen}
        onClose={renameGate.closeUpgradeModal}
        feature="tag-rename"
      />
    </div>
  );
}
