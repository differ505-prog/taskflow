"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Inbox, Sun, CalendarDays, Layers, Tag, BarChart3, CalendarRange,
  Settings, List as LucideList, Timer, Sparkles, Flame, LogOut, MoreVertical
} from "lucide-react";
import { AppView, TaskList, Task } from "@/lib/types";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { ListActionMenu } from "@/components/ListActionMenu";
import { ListIcon as ListIconComponent } from "@/components/ListIcon";

interface BottomNavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: BottomNavItem[] = [
  { view: "inbox", label: "收集箱", icon: <Inbox className="w-[22px] h-[22px]" /> },
  { view: "today", label: "今天", icon: <Sun className="w-[22px] h-[22px]" /> },
  { view: "calendar", label: "日曆", icon: <CalendarDays className="w-[22px] h-[22px]" /> },
  { view: "all", label: "全部", icon: <Layers className="w-[22px] h-[22px]" /> },
];

// 「未來 7 天」已合併至「今天」badge — 減少 nav 選項，降低 ADHD 啟動障礙
const MORE_ITEMS: BottomNavItem[] = [
  { view: "habits", label: "習慣", icon: <BarChart3 className="w-[22px] h-[22px]" /> },
  { view: "tags", label: "標籤", icon: <Tag className="w-[22px] h-[22px]" /> },
  { view: "stats", label: "統計", icon: <Layers className="w-[22px] h-[22px]" /> },
];

interface BottomNavigationProps {
  currentView: AppView;
  currentListId: string | null;
  lists: TaskList[];
  tasks: Task[];
  onNavigate: (view: AppView) => void;
  onSelectList: (listId: string) => void;
  onOpenSidebar: () => void;
  onOpenSettings: () => void;
  onOpenFlowTimer?: () => void;
  onEditList?: (list: TaskList) => void;
  onDeleteList?: (id: string) => void;
  onOpenShareModal?: (list: TaskList, tasks: Task[]) => void;
  todayCount?: number;
}

export function BottomNavigation({ currentView, currentListId, lists, tasks, onNavigate, onSelectList, onOpenSidebar, onOpenSettings, onOpenFlowTimer, onEditList, onDeleteList, onOpenShareModal, todayCount = 0 }: BottomNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  // 手機版清單 menu — 哪一個清單的「⋯」被按
  const [menuListId, setMenuListId] = useState<string | null>(null);

  const handleTap = useCallback((view: AppView) => {
    haptic("selection");
    onNavigate(view);
  }, [onNavigate]);

  const handleMoreToggle = useCallback(() => {
    haptic("selection");
    setMoreOpen((v) => !v);
  }, []);

  const handleMoreItem = useCallback((view: AppView) => {
    haptic("selection");
    setMoreOpen(false);
    onNavigate(view);
  }, [onNavigate]);

  const handleFlowTimer = useCallback(() => {
    haptic("selection");
    onOpenFlowTimer?.();
  }, [onOpenFlowTimer]);

  const handleSettings = useCallback(() => {
    haptic("selection");
    setMoreOpen(false);
    onOpenSettings();
  }, [onOpenSettings]);

  const handleListMore = useCallback((listId: string) => {
    haptic("selection");
    setMenuListId((prev) => (prev === listId ? null : listId));
  }, []);

  const handleListMenuClose = useCallback(() => {
    setMenuListId(null);
  }, []);

  const menuTargetList = menuListId ? lists.find((l) => l.id === menuListId) ?? null : null;

  const moreActive = MORE_ITEMS.some((i) => i.view === currentView);

  return (
    <>
      <nav className="bottom-nav" role="navigation" aria-label="主導覽">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              className={`bottom-nav-item relative ${isActive ? "active" : ""}`}
              onClick={() => handleTap(item.view)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative">
                {item.icon}
                {item.view === "today" && todayCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[7px] h-[7px] rounded-full"
                    style={{ background: "var(--status-danger)" }}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* 心流計時 — 手機直接入口（與桌面側邊欄對齊） */}
        <button
          className="bottom-nav-item"
          onClick={handleFlowTimer}
          aria-label="心流計時"
        >
          <Timer className="w-[22px] h-[22px]" />
          <span className="text-[11px]">心流</span>
        </button>

        {/* 禪模式 — 手機直接入口 */}
        <button
          className="bottom-nav-item"
          onClick={() => { haptic("selection"); window.location.href = "/"; }}
          aria-label="禪模式"
        >
          <Sparkles className="w-[22px] h-[22px]" />
          <span className="text-[11px]">禪</span>
        </button>

        {/* More */}
        <button
          className={`bottom-nav-item relative ${moreActive ? "active" : ""}`}
          onClick={handleMoreToggle}
          aria-label="更多"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
        >
          <MoreIcon />
          <span>更多</span>
        </button>
      </nav>

      {/* More popover */}
      {moreOpen && (
        <MorePopover
          onItem={handleMoreItem}
          onFlowTimer={onOpenFlowTimer ? handleFlowTimer : undefined}
          onSettings={handleSettings}
          onSelectList={onSelectList}
          onOpenSidebar={onOpenSidebar}
          currentView={currentView}
          currentListId={currentListId}
          lists={lists}
          onEditList={onEditList}
          onDeleteList={onDeleteList}
          onOpenShareModal={onOpenShareModal}
          onListMore={handleListMore}
          menuListId={menuListId}
          onMenuClose={handleListMenuClose}
          onClose={() => setMoreOpen(false)}
          onCloseAll={() => { setMoreOpen(false); setMenuListId(null); }}
        />
      )}
    </>
  );
}

function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="5" cy="11" r="1.5" fill="currentColor" />
      <circle cx="11" cy="11" r="1.5" fill="currentColor" />
      <circle cx="17" cy="11" r="1.5" fill="currentColor" />
    </svg>
  );
}

function MorePopover({
  onItem, onFlowTimer, onSettings, onSelectList, onOpenSidebar,
  currentView, currentListId, lists,
  onEditList, onDeleteList, onOpenShareModal,
  onListMore, menuListId, onMenuClose, onClose, onCloseAll,
}: {
  onItem: (v: AppView) => void;
  onFlowTimer?: () => void;
  onSettings: () => void;
  onSelectList: (listId: string) => void;
  onOpenSidebar: () => void;
  currentView: AppView;
  currentListId: string | null;
  lists: TaskList[];
  onEditList?: (list: TaskList) => void;
  onDeleteList?: (id: string) => void;
  onOpenShareModal?: (list: TaskList, tasks: Task[]) => void;
  onListMore: (listId: string) => void;
  menuListId: string | null;
  onMenuClose: () => void;
  onClose: () => void;
  onCloseAll: () => void;
}) {
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error(err);
    }
  };

  const menuTargetList = menuListId ? lists.find((l) => l.id === menuListId) ?? null : null;
  const listHasHandlers = onEditList != null || onDeleteList != null || onOpenShareModal != null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] right-3 z-50 rounded-2xl overflow-y-auto overflow-x-hidden max-h-[75vh]"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}
        role="menu"
        aria-label="更多選項"
      >
        {/* 心流計時器：手機版主要入口，放在清單上方 */}
        {onFlowTimer && (
          <>
            <button
              className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--brand)" }}
              onClick={onFlowTimer}
              role="menuitem"
            >
              <Timer className="w-[22px] h-[22px]" />
              心流計時
            </button>
            <div style={{ height: "1px", background: "var(--border)" }} />
          </>
        )}

        {/* 禪模式：手機版主要入口，心流計時器下方 */}
        <Link
          href="/"
          className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-primary)" }}
          role="menuitem"
          onClick={onClose}
        >
          <Sparkles className="w-[22px] h-[22px]" />
          禪模式
        </Link>
        <div style={{ height: "1px", background: "var(--border)" }} />

        {/* 清單 section */}
        {lists.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              我的清單
            </div>
            {lists.map((list) => {
              const isActive = currentListId === list.id;
              const isMenuOpen = menuListId === list.id;
              return (
                <div
                  key={list.id}
                  className="flex flex-col"
                  style={{
                    color: isActive ? "var(--brand)" : "var(--text-primary)",
                    background: isMenuOpen ? "var(--surface-hover)" : undefined,
                  }}
                >
                  <div className="flex items-center">
                    <button
                      className="flex-1 min-w-0 flex items-center gap-3 px-5 py-3 text-[14px] font-medium text-left transition-colors"
                      onClick={() => { onSelectList(list.id); onClose(); }}
                      role="menuitem"
                    >
                      <span className="flex-shrink-0"><ListIconComponent icon={list.icon} className="w-4 h-4" /></span>
                      <span className="truncate">{list.name}</span>
                    </button>
                    {listHasHandlers && (
                      <button
                        type="button"
                        aria-label={`更多操作 ${list.name}`}
                        aria-expanded={isMenuOpen}
                        className="flex-shrink-0 mr-2 p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: "var(--text-tertiary)" }}
                        onClick={(e) => { e.stopPropagation(); onListMore(list.id); }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {/* Inline menu — 在該列下方展開(如 iOS inline action sheet) */}
                  {isMenuOpen && menuTargetList && (
                    <div className="mx-3 mb-2">
                      <ListActionMenu
                        variant="inline"
                        open
                        onClose={onMenuClose}
                        list={menuTargetList}
                        tasksForShare={[]}
                        onEdit={onEditList ? (l) => { onEditList(l); onCloseAll(); } : undefined}
                        onShare={onOpenShareModal ? (l, tasks) => { onOpenShareModal(l, tasks); onCloseAll(); } : undefined}
                        onDelete={onDeleteList ? (l) => { onDeleteList(l.id); onCloseAll(); } : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ height: "1px", background: "var(--border)" }} />
          </>
        )}

        {MORE_ITEMS.map((item) => (
          <button
            key={item.view}
            className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors"
            style={{ color: currentView === item.view ? "var(--brand)" : "var(--text-primary)" }}
            onClick={() => onItem(item.view)}
            role="menuitem"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
        <div style={{ height: "1px", background: "var(--border)" }} />
        <button
          className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left"
          style={{ color: "var(--text-secondary)" }}
          onClick={onSettings}
          role="menuitem"
        >
          <Settings className="w-[22px] h-[22px]" />
          設定
        </button>
        <div style={{ height: "1px", background: "var(--border)" }} />
        <button
          className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-medium w-full text-left transition-colors hover:bg-red-50"
          style={{ color: "var(--status-danger)" }}
          onClick={handleSignOut}
          role="menuitem"
        >
          <LogOut className="w-[22px] h-[22px]" />
          登出
        </button>
      </div>

      {/* 清單 menu：在 popover 內 inline 展開(取代該列「⋯」位置),
           iOS 慣例 — 不需要額外定位/處理 backdrop,z-index 由 popover 本身的 z-50 統一管理。
           (menu 內容在下方 trigger row 內 conditional render) */}
    </>
  );
}
