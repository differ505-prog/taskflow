"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import { AppView, TaskList } from "@/lib/types";
import { SharedListData } from "@/lib/storage";
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
  Inbox, Sun, CalendarDays, CalendarRange, Layers, Tag, Clock,
  Plus, ChevronDown, ChevronRight, CheckCircle2,
  BarChart3, Timer, Heart, Settings, Archive,
  X, Users,
  Pin, Gauge, Flame,
} from "lucide-react";
import { ListIcon, LIST_ICON_NAMES } from "./ListIcon";
import { ListActionMenu } from "@/components/ListActionMenu";

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
  onOpenFlowTimer?: () => void;
  onOpenShareModal?: (list: TaskList, tasks: import("@/lib/types").Task[]) => void;
  onOpenSharedLists?: () => void;
  onOpenSharedList?: (sharedId: string) => void;
  onLeaveSharedList?: (sharedId: string) => void;
}

export function Sidebar({ onOpenSettings, onOpenListForm, editingList, onEditList, onDeleteList, onOpenFlowTimer, onOpenShareModal, onOpenSharedLists, onOpenSharedList, onLeaveSharedList }: SidebarProps) {
  const { currentView, currentListId, currentSharedListId, setCurrentView, viewCounts, lists, reorderLists, sharedLists, getListTaskCount, tasks, acceptedSharedListIds } = useApp();
  const { user } = useAuth();
  const [listsExpanded, setListsExpanded] = useState(true);
  const [showListMenu, setShowListMenu] = useState<string | null>(null);
  const [showSharedListMenu, setShowSharedListMenu] = useState<string | null>(null);

  // 「未來 7 天」已從 Nav 移除（計數已合併至「今天」badge）
  const mainNavItems: NavItem[] = [
    { view: "inbox", label: "收集箱", icon: <Inbox className="w-[18px] h-[18px]" />, badge: "GTD" },
    { view: "today", label: "今天", icon: <Sun className="w-[18px] h-[18px]" />, count: viewCounts.today + viewCounts.next7days, badge: (viewCounts.today + viewCounts.next7days) > 0 ? String(viewCounts.today + viewCounts.next7days) : undefined },
    { view: "quadrant", label: "緩急圖", icon: <Gauge className="w-[18px] h-[18px]" />, count: viewCounts.q1, badge: "Q1" },
    { view: "all", label: "全部任務", icon: <Layers className="w-[18px] h-[18px]" /> },
  ];

  const archivedCount = tasks.filter((t) => t.isArchived).length;
  const pinnedCount = tasks.filter((t) => t.isPinned && !t.isArchived && t.status !== "done").length;

  const bottomNavItems: NavItem[] = [
    { view: "calendar", label: "月視圖", icon: <CalendarRange className="w-[18px] h-[18px]" />, badge: "月曆 · 排程" },
    { view: "habits", label: "習慣打卡", icon: <Heart className="w-[18px] h-[18px]" /> },
    { view: "tags", label: "標籤管理", icon: <Tag className="w-[18px] h-[18px]" /> },
    { view: "stats", label: "統計分析", icon: <BarChart3 className="w-[18px] h-[18px]" /> },
    { view: "archived", label: "已封存", icon: <Archive className="w-[18px] h-[18px]" />, count: archivedCount },
  ];

  const isActive = (view: AppView, listId?: string) => {
    if (view === "list") {
      if (currentView === "list" && currentListId === listId) return true;
      const list = userLists.find((l) => l.id === listId);
      if (list?.sharedId && currentView === "shared" && currentSharedListId === list.sharedId) return true;
      return false;
    }
    // 月視圖按鈕涵蓋 calendar + command-center(同一個入口)
    if (view === "calendar") return currentView === "calendar" || currentView === "command-center";
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
        <div className="relative w-8 h-8 rounded-[10px] overflow-hidden flex-shrink-0 shadow-sm ring-1 ring-black/5 transition-transform duration-200 hover:scale-105 active:scale-95">
          <Image
            src="/images/vibe-list-icon.jpeg"
            alt="VibeList Icon"
            fill
            className="object-cover"
            sizes="32px"
          />
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
              className="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
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
                      onSelect={() => {
                        if (list.sharedId) {
                          onOpenSharedList?.(list.sharedId);
                        } else {
                          setCurrentView("list", list.id);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setShowListMenu(showListMenu === list.id ? null : list.id);
                      }}
                      taskCount={getListTaskCount(list.id)}
                      onEdit={() => { onEditList?.(list); setShowListMenu(null); }}
                      onShare={onOpenShareModal ? (list, listTasks) => { onOpenShareModal(list, listTasks); setShowListMenu(null); } : undefined}
                      onDelete={onDeleteList ? (list) => {
                        setShowListMenu(null);
                        onDeleteList(list.id);
                      } : undefined}
                      allTasks={tasks}
                    />
                  ))}
                  {/* UX-5: 零清單 Empty State */}
                  {userLists.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-4 px-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                        <Plus className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
                      </div>
                      <p className="text-[12px] text-center leading-snug" style={{ color: "var(--text-tertiary)" }}>
                        建立第一個清單<br />整理你的任務
                      </p>
                      <button
                        onClick={onOpenListForm}
                        className="mt-1 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                      >
                        + 新增清單
                      </button>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Divider */}
        <div className="h-px mx-2 mt-2" style={{ background: "var(--border)" }} />

        {/* Shared lists */}
        {Object.values(sharedLists as Record<string, SharedListData>).filter((d) => {
          const key = d.list.sharedId ?? d.list.id;
          return d.list.ownerId !== user?.uid && acceptedSharedListIds.includes(key);
        }).length > 0 && (
          <div className="pt-2 space-y-0.5">
            <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              共用清單
            </div>
            {Object.values(sharedLists as Record<string, SharedListData>)
              .filter((d) => {
                const key = d.list.sharedId ?? d.list.id;
                return d.list.ownerId !== user?.uid && acceptedSharedListIds.includes(key);
              })
              .map((data) => {
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
                    <span className="flex-shrink-0"><ListIcon icon={data.list.icon} className="w-5 h-5" /></span>
                    <span className="flex-1 text-left truncate">{data.list.name}</span>
                    <span className="text-[11px]" style={{ opacity: 0.6 }}>{data.tasks.filter((t) => t.status !== "done").length}</span>
                  </button>

                  {/* Shared list context menu */}
                  {showSharedListMenu === key && (
                    <ListActionMenu
                      open
                      onClose={() => setShowSharedListMenu(null)}
                      sharedList={data}
                      onLeaveShared={(sharedId) => { onLeaveSharedList?.(sharedId); }}
                    />
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
        {onOpenFlowTimer && (
          <button
            title="心流計時器"
            onClick={onOpenFlowTimer}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
            style={{ color: "var(--text-secondary)" }}
          >
            <Timer className="w-[18px] h-[18px]" />
            心流計時器
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
  onEdit, onShare, onDelete, allTasks,
}: {
  list: TaskList;
  isActive: boolean;
  showMenu: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  taskCount: number;
  onEdit?: () => void;
  onShare?: (list: TaskList, tasks: import("@/lib/types").Task[]) => void;
  onDelete?: (list: TaskList) => void;
  allTasks: import("@/lib/types").Task[];
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
          className="flex-shrink-0 w-11 h-7 -ml-2 flex items-center justify-center rounded-md cursor-grab active:cursor-grabbing hover:bg-[var(--hover-bg)] transition-all duration-150"
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
          <span className="flex-shrink-0"><ListIcon icon={list.icon} className="w-5 h-5" /></span>
          <span className="flex-1 truncate">{list.name}</span>
          {list.sharedId && (
            <span
              className="flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
              style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
              title="共享清單"
              aria-label="共享清單"
            >
              <Users className="w-3 h-3" aria-hidden="true" />
              共享
            </span>
          )}
          <span className="text-[12px]" style={{ opacity: 0.5 }}>{taskCount}</span>
        </button>
      </div>

      {/* Context menu — 用共用 ListActionMenu 元件(桌機與手機 MorePopover 共用) */}
      {showMenu && (
        <div className="absolute right-2 top-full z-50 mt-1">
          <ListActionMenu
            open
            onClose={() => {/* 由父層透過 onEdit/onShare/onDelete 各自處理關閉 */}}
            list={list}
            tasksForShare={allTasks.filter((t) => t.listId === list.id)}
            onEdit={onEdit}
            onShare={onShare}
            onDelete={onDelete}
            taskCount={allTasks.filter((t) => t.listId === list.id && !t.isArchived).length}
          />
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
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors" style={{ color: "var(--text-tertiary)" }} aria-label="關閉">
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
            {LIST_ICON_NAMES.map((iconName) => (
              <button
                key={iconName}
                onClick={() => setIcon(iconName)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
                style={
                  icon === iconName
                    ? { background: "var(--brand-tint)", border: "2px solid var(--brand)" }
                    : { background: "var(--surface-hover)", border: "2px solid transparent" }
                }
              >
                <ListIcon icon={iconName} className="w-5 h-5" />
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
