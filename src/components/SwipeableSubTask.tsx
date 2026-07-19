"use client";

import React, { useState } from "react";
import { Trash2, CheckCircle2, Circle } from "lucide-react";
import { SubTask } from "@/lib/types";
import { TextWithLinks } from "./TextWithLinks";
import { isComposingKey } from "@/utils/imeGuard";

interface SwipeableSubTaskProps {
  sub: SubTask;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onEditCommit: (title: string) => void;
  onDelete: () => void;
}

export function SwipeableSubTask({
  sub,
  isEditing,
  onToggle,
  onEdit,
  onEditCommit,
  onDelete,
}: SwipeableSubTaskProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex items-center gap-2 py-1.5 px-1 rounded-xl group transition-colors hover:bg-neutral-50/60"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox */}
      <label className="flex-shrink-0 w-7 h-7 -m-1 flex items-center justify-center rounded-full cursor-pointer transition-transform [@media(hover:hover)]:hover:scale-110">
        <input
          type="checkbox"
          checked={sub.status === "done"}
          onChange={onToggle}
          className="sr-only"
          aria-label={sub.status === "done" ? "標記未完成" : "標記完成"}
        />
        {sub.status === "done" ? (
          <CheckCircle2 className="w-[18px] h-[18px] text-[var(--status-success)]" />
        ) : (
          <Circle className="w-[18px] h-[18px] text-[var(--text-tertiary)]" />
        )}
      </label>

      {/* Title */}
      {isEditing ? (
        <input
          autoFocus
          type="text"
          defaultValue={sub.title}
          onBlur={(e) => onEditCommit(e.target.value)}
          onKeyDown={(e) => {
            if (isComposingKey(e)) return;
            if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
            if (e.key === "Escape") { onEditCommit(sub.title); }
          }}
          className="flex-1 text-[13px] bg-white/60 rounded px-1.5 py-0.5 outline-none border border-[var(--brand)]/40 focus:border-[var(--brand)]"
          style={{ color: "var(--text-primary)" }}
          aria-label="編輯子任務"
        />
      ) : (
        <span
          onClick={onEdit}
          className={`flex-1 min-w-0 text-[13px] cursor-text rounded px-1 -mx-1 break-words ${sub.status === "done" ? "line-through opacity-50" : ""}`}
          style={{ color: sub.status === "done" ? "var(--text-tertiary)" : "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere" }}
          title="點擊編輯"
        >
          <TextWithLinks
            text={sub.title}
            linkStyle={{
              color: "var(--brand)",
              textDecoration: "underline",
              pointerEvents: "auto",
            }}
          />
        </span>
      )}

      {/* Delete button - visible on hover */}
      {hovered && (
        <button
          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-neutral-400 hover:text-[var(--status-danger)] transition-colors"
          onClick={onDelete}
          aria-label="刪除子任務"
          title="刪除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
