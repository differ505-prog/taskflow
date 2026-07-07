"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
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
import { UserMenu } from "@/components/UserMenu";
import { AuthGate } from "@/components/AuthGate";
import { FirebaseDataProvider, SyncWriter } from "@/components/FirebaseDataProvider";
import { ShareListModal } from "@/components/ShareListModal";
import { TaskList } from "@/lib/types";

// ─── Inner app (has access to useApp) ───────────────────────
function AppLayoutInner() {
  const { currentView, addList, updateList, deleteList, setCurrentView, viewCounts, tasks, checkIncomingShareLink } = useApp();
  const { user } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListFormOpen, setIsListFormOpen] = useState(false);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [shareModalList, setShareModalList] = useState<{ list: TaskList; tasks: import("@/lib/types").Task[] } | null>(null);
  const [showSharedLists, setShowSharedLists] = useState(false);

  // Check for incoming share link on mount
  useEffect(() => {
    const checkShare = async () => {
      const result = await checkIncomingShareLink();
      if (result) {
        // Incoming share will be handled by ShareListModal
      }
    };
    checkShare();
  }, [checkIncomingShareLink]);

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
            onOpenShareModal={(list, listTasks) => setShareModalList({ list, tasks: listTasks })}
            userMenu={<UserMenu />}
          />
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenListForm={handleOpenListForm}
          editingList={editingList}
          onEditList={handleEditList}
          onDeleteList={deleteList}
          onOpenPomodoro={() => setIsPomodoroOpen(true)}
          onOpenShareModal={(list, listTasks) => setShareModalList({ list, tasks: listTasks })}
          onOpenSharedLists={() => setShowSharedLists(true)}
        />
      </div>

      {/* Main content */}
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
              onOpenShareModal={(list, listTasks) => { setIsMobileSidebarOpen(false); setShareModalList({ list, tasks: listTasks }); }}
              onOpenSharedLists={() => { setIsMobileSidebarOpen(false); setShowSharedLists(true); }}
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

      <ShareListModal
        isOpen={shareModalList !== null}
        onClose={() => setShareModalList(null)}
        listToShare={shareModalList?.list}
        listTasks={shareModalList?.tasks}
      />

      <ShareListModal
        isOpen={showSharedLists}
        onClose={() => setShowSharedLists(false)}
        listToShare={null}
      />
    </div>
  );
}

// ─── App with Firebase sync ────────────────────────────────
function AppWithFirebase() {
  const { user } = useAuth();

  return (
    <FirebaseDataProvider>
      {/* SyncWriter: writes localStorage changes → Firestore */}
      {user && <SyncWriter userId={user.uid} />}
      <AppLayoutInner />
    </FirebaseDataProvider>
  );
}

// ─── Root layout ───────────────────────────────────────────
export function AppLayout() {
  const [guestModeEntered, setGuestModeEntered] = useState(false);

  return (
    <AuthProvider>
      <AuthGate onGuestEnter={() => setGuestModeEntered(true)}>
        <AppProvider>
          <AppWithFirebase />
        </AppProvider>
      </AuthGate>
    </AuthProvider>
  );
}
