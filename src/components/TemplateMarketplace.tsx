"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, CheckCircle2, Loader2 } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { TEMPLATES, applyTemplate, type Template } from "@/lib/templates";
import { toast } from "sonner";

interface TemplateMarketplaceProps {
  /** 是否由 SettingsPage 內嵌使用;若 true 會以 section card 形式呈現 */
  embedded?: boolean;
}

/**
 * 範本市集
 *
 * §L0：每組範本內含的 tags 已限制為 0-1 個（避免 nested tag 違規）
 * §13：獨立元件,不耦合 SettingsPage,以便未來嵌入 Onboarding / Quick Start
 */
export function TemplateMarketplace({ embedded = false }: TemplateMarketplaceProps) {
  const { addList, addTask } = useApp();
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = (template: Template) => {
    if (applyingId) return;
    setApplyingId(template.id);
    try {
      const { listId, taskIds } = applyTemplate(template, { addList, addTask });
      toast.success(
        `已套用「${template.name}」,新增 ${taskIds.length} 個任務`,
        { description: "點選側邊欄新清單查看。" }
      );
      setActiveTemplate(null);
      console.log("[Templates] Applied", template.id, "listId=", listId, "taskIds=", taskIds);
    } catch (err) {
      console.error("[Templates] Apply failed:", err);
      toast.error("套用失敗,請稍後再試");
    } finally {
      setApplyingId(null);
    }
  };

  const headerEl = (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--brand-tint)" }}
          aria-hidden="true"
        >
          <Sparkles className="w-4 h-4" style={{ color: "var(--brand)" }} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
            範本市集
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            一鍵建立常用工作流,免從空白畫布開始
          </p>
        </div>
      </div>
    </div>
  );

  const gridEl = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {TEMPLATES.map((t) => {
        const busy = applyingId === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTemplate(t)}
            disabled={!!applyingId}
            className="group flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--surface-muted)" }}
            aria-label={`套用範本：${t.name}`}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: `${t.color}1A` }}
              aria-hidden="true"
            >
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-medium truncate"
                style={{ color: "var(--text-primary)" }}
                title={t.name}
              >
                {t.name}
              </p>
              <p
                className="text-[11px] mt-0.5 line-clamp-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t.description}
              </p>
              <p
                className="text-[11px] mt-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t.tasks.length} 個任務
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  if (embedded) {
    return (
      <div>
        {headerEl}
        {gridEl}

        <AnimatePresence>
          {activeTemplate && (
            <ConfirmDialog
              template={activeTemplate}
              busy={!!applyingId}
              onConfirm={() => handleApply(activeTemplate)}
              onClose={() => setActiveTemplate(null)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── 獨立 Modal 模式（保留給未來 Onboarding 使用）──
  return (
    <div className="p-5">
      {headerEl}
      {gridEl}
    </div>
  );
}

function ConfirmDialog({
  template,
  busy,
  onConfirm,
  onClose,
}: {
  template: Template;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`套用範本 ${template.name}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="card w-full max-w-md p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: `${template.color}1A` }}
              aria-hidden="true"
            >
              {template.icon}
            </div>
            <h3
              className="text-[15px] font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
              title={template.name}
            >
              {template.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
            aria-label="關閉"
          >
            <X className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
          {template.description}
        </p>

        <div className="mb-4">
          <p
            className="text-[11px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            將建立 {template.tasks.length} 個任務
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {template.tasks.map((t, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <CheckCircle2
                  className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                  style={{ color: "var(--brand)" }}
                  aria-hidden="true"
                />
                <span className="break-words">{t.title}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-95 disabled:opacity-60"
            style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
            style={{ background: "var(--brand)", color: "white" }}
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                套用中...
              </>
            ) : (
              <>套用範本</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
