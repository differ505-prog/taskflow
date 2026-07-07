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
import { TaskList } from "@/lib/types";

function AppLayoutInner() {
  const { currentView, addList, updateList, deleteList } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListFormOpen, setIsListFormOpen] = useState(false);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);

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
          />
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenListForm={handleOpenListForm}
        editingList={editingList}
        onEditList={handleEditList}
        onDeleteList={deleteList}
        onOpenPomodoro={() => setIsPomodoroOpen(true)}
      />
      <div className="flex-1 overflow-y-auto">
        {renderView()}
      </div>

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
