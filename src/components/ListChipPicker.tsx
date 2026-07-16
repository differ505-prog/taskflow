"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Inbox } from "lucide-react";
import type { TaskList } from "@/lib/types";

interface ListChipPickerProps {
  lists: TaskList[];
  value: string | undefined;
  onChange: (listId: string | undefined) => void;
}

export function ListChipPicker({ lists, value, onChange }: ListChipPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const current = lists.find((l) => l.id === value);
  const hasValue = Boolean(current);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="選擇任務歸屬清單"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors"
        style={{
          background: hasValue ? "var(--brand-tint)" : "var(--surface)",
          borderColor: hasValue ? "var(--brand)" : "var(--border)",
          color: hasValue ? "var(--brand)" : "var(--text-tertiary)",
        }}
      >
        {current ? (
          <span className="text-[13px] leading-none">{current.icon}</span>
        ) : (
          <Inbox className="w-3.5 h-3.5" />
        )}
        <span>{current ? current.name : "選擇清單"}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 z-30 min-w-[200px] rounded-xl p-1.5"
          style={{
            background: "var(--surface)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => { onChange(undefined); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[13px] rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span className="flex-1">無清單</span>
            {!value && <Check className="w-3.5 h-3.5" style={{ color: "var(--brand)" }} />}
          </button>
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              role="option"
              aria-selected={value === l.id}
              onClick={() => { onChange(l.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[13px] rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-primary)" }}
            >
              <span className="text-[13px] leading-none">{l.icon}</span>
              <span className="flex-1 truncate">{l.name}</span>
              {value === l.id && <Check className="w-3.5 h-3.5" style={{ color: "var(--brand)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
