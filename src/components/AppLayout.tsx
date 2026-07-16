"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { AppProvider, useApp } from "@/lib/AppContext";
import { Sidebar, ListForm } from "@/components/Sidebar";
import { AppShell } from "@/components/AppShell";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
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
import { TaskList, SharedListSnapshot } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";

// ─── Inner app (has access to useApp) ───────────────────────
function AppLayoutInner() {
  const { currentView, currentSharedListId, addList, updateList, deleteList, setCurrentView, setCurrentSharedList, removeAcceptedSharedList, viewCounts, tasks, checkIncomingShareLink } = useApp();
  const { user } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListFormOpen, setIsListFormOpen] = useState(false);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [shareModalList, setShareModalList] = useState<{ list: TaskList; tasks: import("@/lib/types").Task[] } | null>(null);
  const [showSharedLists, setShowSharedLists] = useState(false);
  const [incomingShareData, setIncomingShareData] = useState<{ sharedListId: string; snapshot: SharedListSnapshot } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check for incoming share link on mount
  useEffect(() => {
    const checkShare = async () => {
      const result = await checkIncomingShareLink();
      if (result) {
        setIncomingShareData(result);
        setShowSharedLists(true); // auto-open the modal
      }
    };
    checkShare();
  }, [checkIncomingShareLink]);

  const handleLeaveSharedList = (sharedId: string) => {
    removeAcceptedSharedList(sharedId);
    // If currently viewing the shared list being removed, navigate back to inbox
    if (currentSharedListId === sharedId) {
      setCurrentView("inbox");
    }
  };

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

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  const renderView = () => {
    switch (currentView) {
      case "calendar":
        return (
          <CalendarView
            selectedTaskId={selectedTaskId}
            onSelectTask={(id) => setSelectedTaskId((prev) => (prev === id ? null : id))}
          />
        );
      case "habits":
        return <HabitsPage />;
      case "tags":
        return <TagsPage />;
      case "stats":
        return <StatsClient />;
      default:
        return (
          <AppShell
            selectedTaskId={selectedTaskId}
            onSelectTask={(id) => setSelectedTaskId((prev) => (prev === id ? null : id))}
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

  const renderDetailPanel = () => (
    <AnimatePresence>
      {selectedTask && (
        <motion.div
          key="detail-panel"
          initial={{ opacity: 0, x: isMobile ? "100%" : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isMobile ? "100%" : 20 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className={isMobile ? "fixed inset-0 z-[60] pb-[72px]" : "w-full md:w-[480px] flex-shrink-0 border-l overflow-y-auto"}
          style={{ 
            borderColor: "var(--border)", 
            background: "var(--surface)",
            width: isMobile ? "100%" : 480
          }}
        >
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

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
          onOpenSharedList={(sharedId) => { setCurrentSharedList(sharedId); }}
          onLeaveSharedList={handleLeaveSharedList}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-hidden md:flex pb-[72px] md:pb-0">
        {renderView()}
        {/* Desktop: show detail panel or empty state, Mobile: only show when task selected */}
        <div className="hidden md:flex md:flex-col min-w-0 flex-1">
          {selectedTask ? renderDetailPanel() : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full md:w-[480px] md:min-w-[480px] h-full md:h-auto border-l overflow-hidden flex flex-col items-center justify-center"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-tertiary)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>選擇一個任務</p>
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>點擊左側任務查看詳情</p>
              </div>
            </motion.div>
          )}
        </div>
        {/* Mobile: full-screen overlay when task selected */}
        {selectedTask && isMobile && renderDetailPanel()}
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
              onOpenSharedList={(sharedId) => { setIsMobileSidebarOpen(false); setCurrentSharedList(sharedId); }}
              onLeaveSharedList={(sharedId) => { setIsMobileSidebarOpen(false); handleLeaveSharedList(sharedId); }}
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
        onClose={() => { setShowSharedLists(false); setIncomingShareData(null); }}
        listToShare={null}
        incomingShareData={incomingShareData}
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
