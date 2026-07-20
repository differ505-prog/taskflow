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
import { QuadrantRadarView } from "@/components/QuadrantRadarView";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { ZenFlowProvider } from "@/lib/ZenFlowProvider";
import { BottomNavigation } from "@/components/BottomNavigation";
import { UserMenu } from "@/components/UserMenu";
import { AuthGate } from "@/components/AuthGate";
import { FirebaseDataProvider, SyncWriter } from "@/components/FirebaseDataProvider";
import { ShareListModal } from "@/components/ShareListModal";
import { TaskList, SharedListSnapshot } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useFeatureGate } from "@/lib/useFeatureGate";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ToastProvider } from "@/components/ToastProvider";
import { Onboarding } from "@/components/Onboarding";
import { IOSInstallPrompt, AndroidInstallPrompt, AhaMoment } from "@/components/PwaPrompts";
import { QuickVoiceFAB } from "@/components/QuickVoiceFAB";

// ─── Inner app (has access to useApp) ───────────────────────
function AppLayoutInner() {
  const { currentView, currentListId, currentSharedListId, addList, updateList, deleteList, setCurrentView, setCurrentSharedList, removeAcceptedSharedList, viewCounts, tasks, checkIncomingShareLink, lists, toggleTaskStatus, deleteTask } = useApp();
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
  // ── 批次多選模式───────────────────────
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(() => new Set());
  const toggleBatchSelect = (id: string) => {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const enterBatchMode = (firstSelectedId?: string) => {
    // PRO 守衛：free 用戶嘗試進入批次模式 → 觸發 UpgradeModal
    if (batchMode) {
      setBatchMode(false);
      setBatchSelectedIds(new Set());
      return;
    }
    setBatchMode(true);
    if (firstSelectedId) {
      setBatchSelectedIds((prev) => new Set(prev).add(firstSelectedId));
    }
  };
  const exitBatchMode = () => {
    setBatchMode(false);
    setBatchSelectedIds(new Set());
  };

  // 批次標記完成 / 刪除
  const handleBatchComplete = async () => {
    for (const id of batchSelectedIds) {
      const t = tasks.find((x) => x.id === id);
      if (t && t.status !== "done") toggleTaskStatus(id);
    }
    exitBatchMode();
  };
  const handleBatchDelete = async () => {
    if (!confirm(`確定要刪除 ${batchSelectedIds.size} 項任務嗎?`)) return;
    for (const id of batchSelectedIds) {
      deleteTask(id);
    }
    exitBatchMode();
  };
  const [isMobile, setIsMobile] = useState(false);

  // Bug fix: clear task selection when switching lists or views
  useEffect(() => {
    setSelectedTaskId(null);
  }, [currentView, currentListId, currentSharedListId]);

  // 切換清單/視圖時自動退出批次模式,避免殘留
  useEffect(() => {
    exitBatchMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, currentListId, currentSharedListId]);

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
      case "quadrant":
        return <QuadrantRadarView onTaskSelect={(id) => setSelectedTaskId(id)} />;
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
            batchMode={batchMode}
            batchSelectedIds={batchSelectedIds}
            onEnterBatchMode={enterBatchMode}
            onToggleBatchSelect={toggleBatchSelect}
            onExitBatchMode={exitBatchMode}
            onBatchComplete={handleBatchComplete}
            onBatchDelete={handleBatchDelete}
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
          className={isMobile ? "fixed inset-0 z-[60] overflow-y-auto overscroll-contain" : "w-full md:w-[480px] flex-shrink-0 border-l overflow-hidden"}
          style={{ 
            borderColor: "var(--border)", 
            background: "var(--surface)",
            width: isMobile ? "100%" : 480
          }}
        >
          <div className="h-full overflow-y-auto overscroll-contain">
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => setSelectedTaskId(null)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <Onboarding />
      <IOSInstallPrompt />
      <AndroidInstallPrompt />
      <AhaMoment />
      <div className="flex h-[100dvh] overflow-hidden">
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

      {/* Main content — flex column, AppShell scrolls within */}
      <div className="flex-1 min-w-0 flex flex-col pb-[calc(60px+env(safe-area-inset-bottom,0px)+12px)] md:pb-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {renderView()}
        </div>
      </div>
      {/* Desktop: detail panel as sibling → renders to the right via flex parent */}
      {selectedTask && !isMobile && renderDetailPanel()}
      {/* Mobile: full-screen overlay when task selected */}
      {selectedTask && isMobile && renderDetailPanel()}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavigation
          currentView={currentView}
          currentListId={currentListId ?? null}
          lists={lists}
          onNavigate={(v) => setCurrentView(v)}
          onSelectList={(id) => setCurrentView("list", id)}
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenPomodoro={() => setIsPomodoroOpen(true)}
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

      {/* Quick Voice FAB — 永遠顯示,跨頁面捕捉靈感 */}
      <QuickVoiceFAB />

      </div>
    </>
  );
}

// ─── App with Firebase sync ────────────────────────────────
function AppWithFirebase() {
  const { user } = useAuth();

  return (
    <FirebaseDataProvider>
      {/* SyncWriter: writes localStorage changes → Firestore */}
      {user && <SyncWriter userId={user.uid} />}
      <ToastProvider />
      <AppLayoutInner />
    </FirebaseDataProvider>
  );
}

// ─── Root layout ───────────────────────────────────────────
export function AppLayout() {
  const [guestModeEntered, setGuestModeEntered] = useState(false);
  const omnisonicUrl = process.env.NEXT_PUBLIC_OMNISONIC_URL ?? "";

  return (
    <AuthProvider>
      <AuthGate onGuestEnter={() => setGuestModeEntered(true)}>
        <AppProvider>
          <ZenFlowProvider omnisonicBaseUrl={omnisonicUrl}>
            <AppWithFirebase />
          </ZenFlowProvider>
        </AppProvider>
      </AuthGate>
    </AuthProvider>
  );
}
