"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { AppView, TaskList } from "@/lib/types";
import {
  Inbox, Sun, CalendarDays, Layers, Tag, Clock,
  Plus, ChevronDown, ChevronRight, CheckCircle2,
  BarChart3, Timer, Heart, Settings, Archive,
  MoreHorizontal, Edit3, Trash2, X,
} from "lucide-react";

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
  count?: number;
  badge?: string;
}

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenListForm: () => void;
  editingList?: TaskList | null;
  onEditList?: (list: TaskList) => void;
  onDeleteList?: (id: string) => void;
  onOpenPomodoro?: () => void;
}

const LIST_ICONS = ["📋", "💼", "🏠", "🏃", "📚", "💡", "🎯", "🌟", "💰", "🏥", "✈️", "🎨", "🍽️", "🛠️", "📱", "💻"];

export function Sidebar({ onOpenSettings, onOpenListForm, editingList, onEditList, onDeleteList, onOpenPomodoro }: SidebarProps) {
  const { currentView, currentListId, setCurrentView, viewCounts, lists, getListTaskCount } = useApp();
  const [listsExpanded, setListsExpanded] = useState(true);
  const [showListMenu, setShowListMenu] = useState<string | null>(null);

  const mainNavItems: NavItem[] = [
    { view: "inbox", label: "收集箱", icon: <Inbox className="w-[18px] h-[18px]" />, count: viewCounts.inbox },
    { view: "today", label: "今天", icon: <Sun className="w-[18px] h-[18px]" />, count: viewCounts.today, badge: viewCounts.today > 0 ? String(viewCounts.today) : undefined },
    { view: "next7days", label: "未來 7 天", icon: <CalendarDays className="w-[18px] h-[18px]" />, count: viewCounts.next7days },
    { view: "all", label: "全部任務", icon: <Layers className="w-[18px] h-[18px]" /> },
  ];

  const bottomNavItems: NavItem[] = [
    { view: "habits", label: "習慣打卡", icon: <Heart className="w-[18px] h-[18px]" /> },
    { view: "calendar", label: "日曆視圖", icon: <Clock className="w-[18px] h-[18px]" /> },
    { view: "tags", label: "標籤管理", icon: <Tag className="w-[18px] h-[18px]" /> },
    { view: "stats", label: "統計分析", icon: <BarChart3 className="w-[18px] h-[18px]" /> },
  ];

  const isActive = (view: AppView, listId?: string) => {
    if (view === "list") return currentView === "list" && currentListId === listId;
    return currentView === view;
  };

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--surface-sidebar)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8L6.5 11.5L13 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-[16px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>TaskFlow</span>
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">

        {/* Main views */}
        <div className="pt-1 pb-2">
          {mainNavItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150 group"
              style={
                isActive(item.view)
                  ? { background: "var(--brand-tint)", color: "var(--brand)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              <span className="flex-shrink-0" style={isActive(item.view) ? { color: "var(--brand)" } : {}}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
                >
                  {item.badge}
                </span>
              )}
              {!item.badge && item.count !== undefined && (
                <span className="text-[12px]" style={{ opacity: 0.5 }}>{item.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px mx-2" style={{ background: "var(--border)" }} />

        {/* Lists section */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-3 mb-1">
            <button
              onClick={() => setListsExpanded(!listsExpanded)}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest hover:opacity-80 transition-opacity"
              style={{ color: "var(--text-tertiary)" }}
            >
              {listsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              清單
            </button>
            <button
              onClick={onOpenListForm}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="新增清單"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {listsExpanded && (
            <div className="space-y-0.5">
              {lists.map((list) => (
                <div key={list.id} className="relative">
                  <button
                    onClick={() => setCurrentView("list", list.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setShowListMenu(showListMenu === list.id ? null : list.id);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium transition-all duration-150"
                    style={
                      isActive("list", list.id)
                        ? { background: "var(--brand-tint)", color: "var(--brand)" }
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    <span className="flex-shrink-0 text-base leading-none">{list.icon}</span>
                    <span className="flex-1 text-left truncate">{list.name}</span>
                    <span className="text-[12px]" style={{ opacity: 0.5 }}>{getListTaskCount(list.id)}</span>
                  </button>

                  {/* List context menu */}
                  {showListMenu === list.id && (
                    <div
                      className="absolute right-2 top-full z-50 mt-1 py-1 w-40 rounded-xl border"
                      style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-md)", borderColor: "var(--border)" }}
                    >
                      <button
                        onClick={() => { onEditList?.(list); setShowListMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        style={{ color: "var(--text-primary)" }}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> 編輯清單
                      </button>
                      <button
                        onClick={() => { onDeleteList?.(list.id); setShowListMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        style={{ color: "var(--status-danger)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 刪除清單
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px mx-2 mt-2" style={{ background: "var(--border)" }} />

        {/* Secondary views */}
        <div className="pt-2 space-y-0.5">
          {bottomNavItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
              style={
                isActive(item.view)
                  ? { background: "var(--brand-tint)", color: "var(--brand)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="p-2 border-t space-y-1" style={{ borderColor: "var(--border)" }}>
        {onOpenPomodoro && (
          <button
            onClick={onOpenPomodoro}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
            style={{ color: "var(--brand)" }}
          >
            <Timer className="w-[18px] h-[18px]" />
            專注計時
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
          style={{ color: "var(--text-secondary)" }}
        >
          <Settings className="w-[18px] h-[18px]" />
          設定
        </button>
      </div>
    </aside>
  );
}

// ─── List Form Modal ──────────────────────────────────────────
interface ListFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; icon: string; color: string }) => void;
  initialData?: TaskList | null;
  onDelete?: (id: string) => void;
}

export function ListForm({ isOpen, onClose, onSubmit, initialData, onDelete }: ListFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [icon, setIcon] = useState(initialData?.icon || "📋");
  const [color, setColor] = useState(initialData?.color || "#636366");
  const [isEditing] = useState(!!initialData);

  const [isOpen2, setIsOpen2] = useState(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.3)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEditing ? "編輯清單" : "新增清單"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 transition-colors" style={{ color: "var(--text-tertiary)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>清單名稱</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：工作、購物、學習"
            className="input"
            maxLength={30}
            autoFocus
          />
        </div>

        {/* Icon picker */}
        <div>
          <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>圖示</label>
          <div className="flex flex-wrap gap-2">
            {LIST_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className="w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all duration-150"
                style={
                  icon === ic
                    ? { background: "var(--brand-tint)", border: "2px solid var(--brand)" }
                    : { background: "var(--surface-hover)", border: "2px solid transparent" }
                }
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block mb-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>顏色</label>
          <div className="flex gap-2">
            {["#636366", "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#06B6D4"].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-all duration-150"
                style={{
                  background: c,
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                  boxShadow: color === c ? `0 0 0 3px var(--surface-elevated), 0 0 0 5px ${c}` : "none",
                }}
                aria-label={`選擇顏色 ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {isEditing && onDelete && (
            <button
              onClick={() => { onDelete(initialData!.id); onClose(); }}
              className="px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
              style={{ background: "rgba(255,59,48,0.1)", color: "var(--status-danger)" }}
            >
              刪除
            </button>
          )}
          <button onClick={onClose} className="btn-ghost flex-1">取消</button>
          <button
            onClick={() => {
              if (!name.trim()) return;
              onSubmit({ name: name.trim(), icon, color });
              onClose();
            }}
            className="btn-primary flex-1"
          >
            {isEditing ? "儲存" : "建立"}
          </button>
        </div>
      </div>
    </div>
  );
}
