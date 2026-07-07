"use client";

import { useState, useCallback } from "react";
import {
  Inbox, Sun, CalendarDays, Layers, Tag, BarChart3, Timer,
  Settings,
} from "lucide-react";
import { AppView } from "@/lib/types";
import { haptic } from "@/lib/haptics";

interface BottomNavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: BottomNavItem[] = [
  { view: "inbox", label: "收集箱", icon: <Inbox className="w-[22px] h-[22px]" /> },
  { view: "today", label: "今天", icon: <Sun className="w-[22px] h-[22px]" /> },
  { view: "next7days", label: "七日", icon: <CalendarDays className="w-[22px] h-[22px]" /> },
  { view: "all", label: "全部", icon: <Layers className="w-[22px] h-[22px]" /> },
  { view: "calendar", label: "日曆", icon: <Timer className="w-[22px] h-[22px]" /> },
];

const MORE_ITEMS: BottomNavItem[] = [
  { view: "habits", label: "習慣", icon: <BarChart3 className="w-[22px] h-[22px]" /> },
  { view: "tags", label: "標籤", icon: <Tag className="w-[22px] h-[22px]" /> },
  { view: "stats", label: "統計", icon: <Layers className="w-[22px] h-[22px]" /> },
];

interface BottomNavigationProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenSettings: () => void;
  todayCount?: number;
}

export function BottomNavigation({ currentView, onNavigate, onOpenSettings, todayCount = 0 }: BottomNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);

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

  const handleSettings = useCallback(() => {
    haptic("selection");
    setMoreOpen(false);
    onOpenSettings();
  }, [onOpenSettings]);

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
      {moreOpen && <MorePopover onItem={handleMoreItem} onSettings={handleSettings} currentView={currentView} onClose={() => setMoreOpen(false)} />}
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

function MorePopover({ onItem, onSettings, currentView, onClose }: {
  onItem: (v: AppView) => void;
  onSettings: () => void;
  currentView: AppView;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] right-3 z-50 rounded-2xl overflow-hidden"
        style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}
        role="menu"
        aria-label="更多選項"
      >
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
      </div>
    </>
  );
}
