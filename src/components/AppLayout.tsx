"use client";

import { useState } from "react";
import { AppProvider, useApp } from "@/lib/AppContext";
import { Sidebar, ListForm } from "@/components/Sidebar";
import { AppShell } from "@/components/AppShell";
import { SettingsPage } from "@/components/SettingsPage";
import { CalendarView } from "@/components/CalendarView";
import { HabitsPage } from "@/components/HabitsPage";
import StatsClient from "@/components/StatsClient";
import { TagsPage } from "@/components/TagsPage";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { BottomNavigation } from "@/components/BottomNavigation";
import { TaskList } from "@/lib/types";

function AppLayoutInner() {
  const { currentView, addList, updateList, deleteList, setCurrentView, viewCounts } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListFormOpen, setIsListFormOpen] = useState(false);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleOpenListForm = () => {
    setEditingList(null);
    setIsListFormOpen(true);
  };

  const handleEditList = (list: TaskList) => {
    setEditingList(list);
    setIsListFormOpen(true);
  };

  const handleListSubmit = (data: { name: string; icon: string; color: string }) => {
    if (editingList) {
      updateList(editingList.id, data);
    } else {
      addList(data);
    }
  };

  const handleNavigate = (view: import("@/lib/types").AppView) => {
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case "calendar":
        return <CalendarView />;
      case "habits":
        return <HabitsPage />;
      case "tags":
        return <TagsPage />;
      case "stats":
        return <StatsClient />;
      default:
        return (
          <AppShell
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenListForm={handleOpenListForm}
            onEditList={handleEditList}
            onDeleteList={deleteList}
            onOpenPomodoro={() => setIsPomodoroOpen(true)}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar — hidden on mobile */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenListForm={handleOpenListForm}
          editingList={editingList}
          onEditList={handleEditList}
          onDeleteList={deleteList}
          onOpenPomodoro={() => setIsPomodoroOpen(true)}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto pb-[72px] md:pb-0">
        {renderView()}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavigation
          currentView={currentView}
          onNavigate={handleNavigate}
          onOpenSettings={() => setIsSettingsOpen(true)}
          todayCount={viewCounts.today}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div
            className="md:hidden fixed top-0 left-0 bottom-0 w-[280px] z-50 flex flex-col"
            style={{ background: "var(--surface-sidebar)" }}
          >
            <Sidebar
              onOpenSettings={() => { setIsMobileSidebarOpen(false); setIsSettingsOpen(true); }}
              onOpenListForm={handleOpenListForm}
              editingList={editingList}
              onEditList={handleEditList}
              onDeleteList={deleteList}
              onOpenPomodoro={() => { setIsMobileSidebarOpen(false); setIsPomodoroOpen(true); }}
            />
          </div>
        </>
      )}

      {isSettingsOpen && (
        <SettingsPage isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}

      <ListForm
        isOpen={isListFormOpen}
        onClose={() => { setIsListFormOpen(false); setEditingList(null); }}
        onSubmit={handleListSubmit}
        initialData={editingList}
        onDelete={editingList ? deleteList : undefined}
      />

      <PomodoroTimer isOpen={isPomodoroOpen} onClose={() => setIsPomodoroOpen(false)} />
    </div>
  );
}

export function AppLayout() {
  return (
    <AppProvider>
      <AppLayoutInner />
    </AppProvider>
  );
}
