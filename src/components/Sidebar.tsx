"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { AppView, TaskList } from "@/lib/types";
import { useConfirm } from "@/hooks/useConfirm";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  Inbox, Sun, CalendarDays, Layers, Tag, Clock,
  Plus, ChevronDown, ChevronRight, CheckCircle2,
  BarChart3, Timer, Heart, Settings, Archive,
  MoreHorizontal, Edit3, Trash2, X, Share2, Users,
  Pin, Gauge,
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
  onOpenShareModal?: (list: TaskList, tasks: import("@/lib/types").Task[]) => void;
  onOpenSharedLists?: () => void;
  onOpenSharedList?: (sharedId: string) => void;
  onLeaveSharedList?: (sharedId: string) => void;
}

const LIST_ICONS = ["📋", "💼", "🏠", "🏃", "📚", "💡", "🎯", "🌟", "💰", "🏥", "✈️", "🎨", "🍽️", "🛠️", "📱", "💻"];

export function Sidebar({ onOpenSettings, onOpenListForm, editingList, onEditList, onDeleteList, onOpenPomodoro, onOpenShareModal, onOpenSharedLists, onOpenSharedList, onLeaveSharedList }: SidebarProps) {
  const { currentView, currentListId, currentSharedListId, setCurrentView, viewCounts, lists, reorderLists, sharedLists, getListTaskCount, tasks } = useApp();
  const confirm = useConfirm();
  const [listsExpanded, setListsExpanded] = useState(true);
  const [showListMenu, setShowListMenu] = useState<string | null>(null);
  const [showSharedListMenu, setShowSharedListMenu] = useState<string | null>(null);

  const mainNavItems: NavItem[] = [
    { view: "inbox", label: "收集箱", icon: <Inbox className="w-[18px] h-[18px]" />, badge: "GTD" },
    { view: "today", label: "今天", icon: <Sun className="w-[18px] h-[18px]" />, count: viewCounts.today, badge: viewCounts.today > 0 ? String(viewCounts.today) : undefined },
    { view: "next7days", label: "未來 7 天", icon: <CalendarDays className="w-[18px] h-[18px]" />, count: viewCounts.next7days },
    { view: "quadrant", label: "緩急圖", icon: <Gauge className="w-[18px] h-[18px]" />, count: viewCounts.q1, badge: "Q1" },
    { view: "all", label: "全部任務", icon: <Layers className="w-[18px] h-[18px]" /> },
  ];

  const archivedCount = tasks.filter((t) => t.isArchived).length;
  const pinnedCount = tasks.filter((t) => t.isPinned && !t.isArchived && t.status !== "done").length;

  const bottomNavItems: NavItem[] = [
    { view: "habits", label: "習慣打卡", icon: <Heart className="w-[18px] h-[18px]" /> },
    { view: "calendar", label: "日曆視圖", icon: <Clock className="w-[18px] h-[18px]" /> },
    { view: "tags", label: "標籤管理", icon: <Tag className="w-[18px] h-[18px]" /> },
    { view: "stats", label: "統計分析", icon: <BarChart3 className="w-[18px] h-[18px]" /> },
    { view: "archived", label: "已封存", icon: <Archive className="w-[18px] h-[18px]" />, count: archivedCount },
  ];

  const isActive = (view: AppView, listId?: string) => {
    if (view === "list") return currentView === "list" && currentListId === listId;
    return currentView === view;
  };

  // §24.1：PointerSensor delay 200ms 容錯 5px，避免按下手柄時與 scroll 衝突
  //         KeyboardSensor 為桌機 a11y
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 自有清單（排除「收集箱」/「已封存」等系統預設；只拖用戶自建清單）
  const userLists = lists.filter((l) => l.name !== "收集箱");

  const handleListDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = userLists.findIndex((l) => l.id === active.id);
    const newIndex = userLists.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(userLists, oldIndex, newIndex);
    reorderLists(next);
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
        <span className="text-[16px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>VibeList</span>
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">

        {/* Main views */}
        <div className="pt-1 pb-2">
          {mainNavItems.map((item) => {
            const active = isActive(item.view);
            const isInbox = item.view === "inbox";
            return (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150 group ${isInbox && active ? "inbox-active-glow" : ""}`}
                style={
                  active
                    ? { background: "var(--brand-tint)", color: "var(--brand)" }
                    : { color: "var(--text-secondary)" }
                }
              >
                <span className="flex-shrink-0" style={active ? { color: "var(--brand)" } : {}}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 mr-1"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                    title={item.view === "inbox" ? "Getting Things Done：清空大腦工作記憶，降低認知負載" : undefined}
                  >
                    {item.badge}
                  </span>
                )}
                {(item.count !== undefined || item.badge) && (
                  <span className="text-[12px] flex-shrink-0" style={{ opacity: 0.5 }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Pinned */}
          <button
            onClick={() => setCurrentView("pinned")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150 group"
            style={
              isActive("pinned")
                ? { background: "var(--brand-tint)", color: "var(--brand)" }
                : { color: "var(--text-secondary)" }
            }
            title="跨清單收集所有置頂任務"
          >
            <span className="flex-shrink-0" style={isActive("pinned") ? { color: "var(--brand)" } : {}}>
              <Pin className="w-[18px] h-[18px]" />
            </span>
            <span className="flex-1 text-left">置頂</span>
            {pinnedCount > 0 && (
              <span className="text-[12px] flex-shrink-0" style={{ opacity: 0.5 }}>
                {pinnedCount}
              </span>
            )}
          </button>
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleListDragEnd}>
              <SortableContext items={userLists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {/* 過濾掉預設的「收集箱」清單 — 它在 mainNavItems 已由 virtual view 顯示,
                      否則側邊欄會同時出現 2 個「收集箱」(一個帶 GTD badge,一個帶 📥 emoji 計數) */}
                  {userLists.map((list) => (
                    <SortableListItem
                      key={list.id}
                      list={list}
                      isActive={isActive("list", list.id)}
                      showMenu={showListMenu === list.id}
                      onSelect={() => setCurrentView("list", list.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setShowListMenu(showListMenu === list.id ? null : list.id);
                      }}
                      taskCount={getListTaskCount(list.id)}
                      onEdit={() => { onEditList?.(list); setShowListMenu(null); }}
                      onShare={onOpenShareModal ? () => { onOpenShareModal(list, tasks.filter((t) => t.listId === list.id)); setShowListMenu(null); } : undefined}
                      onDelete={onDeleteList ? async () => {
                        const taskCount = tasks.filter((t) => t.listId === list.id && !t.isArchived).length;
                        const ok = await confirm({
                          title: `刪除清單「${list.name}」`,
                          message: "此操作會將清單下的任務改為「未分類」,清單本身將永久移除。",
                          impactDetail: taskCount > 0 ? `${taskCount} 項任務將改為未分類` : "此清單下沒有任務",
                          confirmText: "刪除清單",
                          tone: "danger",
                        });
                        if (ok) {
                          onDeleteList(list.id);
                          setShowListMenu(null);
                        }
                      } : undefined}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Divider */}
        <div className="h-px mx-2 mt-2" style={{ background: "var(--border)" }} />

        {/* Shared lists */}
        {Object.values(sharedLists).length > 0 && (
          <div className="pt-2 space-y-0.5">
            <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              共用清單
            </div>
            {Object.values(sharedLists).map((data) => {
              const key = data.list.sharedId ?? data.list.id;
              const isActiveShared = currentSharedListId === key;
              return (
                <div key={key} className="relative">
                  <button
                    onClick={() => onOpenSharedList?.(key)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setShowSharedListMenu(showSharedListMenu === key ? null : key);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
                    style={
                      isActiveShared
                        ? { background: "var(--brand-tint)", color: "var(--brand)" }
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    <span className="text-base flex-shrink-0">{data.list.icon}</span>
                    <span className="flex-1 text-left truncate">{data.list.name}</span>
                    <span className="text-[11px]" style={{ opacity: 0.6 }}>{data.tasks.filter((t) => t.status !== "done").length}</span>
                  </button>

                  {/* Shared list context menu */}
                  {showSharedListMenu === key && (
                    <div
                      className="absolute right-2 top-full z-50 mt-1 py-1 w-44 rounded-xl border"
                      style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-md)", borderColor: "var(--border)" }}
                    >
                      <button
                        onClick={() => { onLeaveSharedList?.(key); setShowSharedListMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        style={{ color: "var(--status-danger)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 退出共用清單
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {onOpenSharedLists && (
          <div className="pt-1">
            <button
              onClick={onOpenSharedLists}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Users className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="flex-1 text-left">管理收藏</span>
            </button>
          </div>
        )}

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
            title="番茄工作法 (Pomodoro Technique)"
            onClick={onOpenPomodoro}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
            style={{ color: "var(--text-secondary)" }}
          >
            <Timer className="w-[18px] h-[18px]" />
            番茄鐘
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

// ─── Sortable List Item (O-006) ──────────────────────────────────────
// 只把 list 整列的拖曳 handlers 交給手柄按鈕，按鈕本體仍正常 click/cxtmenu 不衝突
function SortableListItem({
  list, isActive, showMenu, onSelect, onContextMenu, taskCount,
  onEdit, onShare, onDelete,
}: {
  list: TaskList;
  isActive: boolean;
  showMenu: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  taskCount: number;
  onEdit: () => void;
  onShare?: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: list.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // §24.1：桌機 hover 才出現手柄、手機永遠顯示
  // 手柄需獨立 touch-action: none 避免 dnd-kit setPointerCapture + iOS Safari 觸控衝突
  const handleSetRef = (el: HTMLButtonElement | null) => {
    if (el) {
      el.style.touchAction = "none";
      el.style.userSelect = "none";
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[14px] font-medium transition-all duration-150"
        style={
          isActive
            ? { background: "var(--brand-tint)", color: "var(--brand)" }
            : { color: "var(--text-secondary)" }
        }
      >
        {/* 拖曳手柄：桌機 hover 才出現；手機永遠顯示。手柄 listeners + attributes 唯一拖曳入口 */}
        <button
          ref={handleSetRef}
          type="button"
          aria-label={`拖曳排序 ${list.name}`}
          className="flex-shrink-0 w-11 h-7 -ml-2 flex items-center justify-center rounded-md cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-150"
          style={{ color: "var(--text-tertiary)", touchAction: "none" }}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* 主按鈕：點擊切換 view / 右鍵 context menu。手柄外區域、與拖曳零衝突 */}
        <button
          type="button"
          onClick={onSelect}
          onContextMenu={onContextMenu}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <span className="flex-shrink-0 text-base leading-none">{list.icon}</span>
          <span className="flex-1 truncate">{list.name}</span>
          <span className="text-[12px]" style={{ opacity: 0.5 }}>{taskCount}</span>
        </button>
      </div>

      {/* Context menu */}
      {showMenu && (
        <div
          className="absolute right-2 top-full z-50 mt-1 py-1 w-44 rounded-xl border"
          style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-md)", borderColor: "var(--border)" }}
        >
          <button
            onClick={onEdit}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-primary)" }}
          >
            <Edit3 className="w-3.5 h-3.5" /> 編輯清單
          </button>
          {onShare && (
            <button
              onClick={onShare}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              style={{ color: "var(--brand)" }}
            >
              <Share2 className="w-3.5 h-3.5" /> 分享清單
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              style={{ color: "var(--status-danger)" }}
            >
              <Trash2 className="w-3.5 h-3.5" /> 刪除清單
            </button>
          )}
        </div>
      )}
    </div>
  );
}


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
  const isEditing = !!initialData;

  // Sync state with initialData when it changes (e.g., switching between new/edit)
  useEffect(() => {
    setName(initialData?.name || "");
    setIcon(initialData?.icon || "📋");
    setColor(initialData?.color || "#636366");
  }, [initialData]);

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
