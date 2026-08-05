"use client";
import { toast } from "sonner";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useApp } from "@/lib/AppContext";
import { Sidebar, ListForm } from "@/components/Sidebar";
import { AppShell } from "@/components/AppShell";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import { SettingsPage } from "@/components/SettingsPage";
import { CalendarView } from "@/components/CalendarView";
import { HabitsPage } from "@/components/HabitsPage";
import StatsClient from "@/components/StatsClient";
import { TagsPage } from "@/components/TagsPage";
import { QuadrantRadarView } from "@/components/QuadrantRadarView";
import { FlowTimerModal } from "@/components/FlowTimerModal";
import { useBfcacheKey } from "@/components/BfcacheHandler";
import { BottomNavigation } from "@/components/BottomNavigation";
import { UserMenu } from "@/components/UserMenu";
import { ShareListModal } from "@/components/ShareListModal";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { PullToRefresh } from "@/components/PullToRefresh";
import { TaskList, SharedListSnapshot, Task } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useFeatureGate } from "@/lib/useFeatureGate";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Onboarding } from "@/components/Onboarding";
import { IOSInstallPrompt, AndroidInstallPrompt, AhaMoment } from "@/components/PwaPrompts";
import { QuickVoiceFAB } from "@/components/QuickVoiceFAB";
import { StatusWindow } from "@/components/StatusWindow";
import { CommandCenter } from "@/components/CommandCenter";
import { LevelUpNotification } from "@/components/LevelUpNotification";
import { useConfirm } from "@/hooks/useConfirm";
import { Calendar, Clock, Eye, Flame } from "lucide-react";

// ─── Inner app (has access to useApp) ───────────────────────
function AppLayoutInner() {
  const { currentView, currentListId, currentSharedListId, addList, updateList, deleteList, setCurrentView, setCurrentSharedList, removeAcceptedSharedList, viewCounts, tasks, checkIncomingShareLink, lists, toggleTaskStatus, completeTask, deleteTask, forceReload, sharedLists } = useApp();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListFormOpen, setIsListFormOpen] = useState(false);
  const [isFlowTimerOpen, setIsFlowTimerOpen] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [shareModalList, setShareModalList] = useState<{ list: TaskList; tasks: import("@/lib/types").Task[] } | null>(null);
  const [showSharedLists, setShowSharedLists] = useState(false);
  const [incomingShareData, setIncomingShareData] = useState<{ sharedListId: string; snapshot: SharedListSnapshot } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [calendarSelectedTask, setCalendarSelectedTask] = useState<Task | null>(null);
  // [Fix] 從 CalendarView 提升上來,讓 ESC handler 能統一清掉,避免 sheet 死鎖
  // (§26 O' 雙 hook 獨立 state 死鎖 — useBottomSheet 的 ESC listener 把 internalLevel 設為 closed,
  // 但 selectedDate 沒被清 → 下次點同一日期不會重開 sheet → 任務再也點不開)
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const getBfcacheKey = useBfcacheKey();
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
  // §A2 批次完成走 completeTask:週期任務會自動推進到下個週期(就跟 ✓ 按下時一致)
  const handleBatchComplete = async () => {
    for (const id of batchSelectedIds) {
      const t = tasks.find((x) => x.id === id);
      if (t && t.status !== "done") completeTask(id);
    }
    exitBatchMode();
  };
  const handleBatchDelete = async () => {
    const ok = await confirm({
      intent: "delete",
      title: `刪除 ${batchSelectedIds.size} 項任務`,
      message: `這 ${batchSelectedIds.size} 項任務將從所有清單中移除,此操作無法復原。`,
      impactDetail: `${batchSelectedIds.size} 項任務將永久刪除`,
      tone: "danger",
    });
    if (!ok) return;
    for (const id of batchSelectedIds) {
      deleteTask(id);
    }
    exitBatchMode();
  };
  const [isMobile, setIsMobile] = useState(false);

  // Bug fix: clear task selection when switching lists or views
  useEffect(() => {
    setSelectedTaskId(null);
    setCalendarSelectedDate(null); // 切換視圖時也清,避免殘留在別的視圖被打開
  }, [currentView, currentListId, currentSharedListId]);

  // 切換清單/視圖時自動退出批次模式,避免殘留
  useEffect(() => {
    exitBatchMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, currentListId, currentSharedListId]);

  // ── 全域鍵盤快捷鍵 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 忽略在 input/textarea/contenteditable 內的按鍵
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "Escape") {
        if (isSettingsOpen) { setIsSettingsOpen(false); return; }
        if (isFlowTimerOpen) { setIsFlowTimerOpen(false); return; }
        if (selectedTaskId || calendarSelectedTask) {
          setSelectedTaskId(null);
          setCalendarSelectedTask(null);
          // [Fix] ESC 也清掉 calendar selectedDate,讓 sheet 回到「未選日期」狀態 —
          // 下次點日期時 useBottomSheet 重新 mount,internalLevel 重置為 "default",sheet 正常彈出
          // (根因:之前 useBottomSheet 的 ESC 把 internalLevel 設為 closed,但 selectedDate 沒清,
          // sheet 永久留在 closed 狀態,所有任務再也打不開)
          setCalendarSelectedDate(null);
          return;
        }
        // ESC 也清掉 calendar selectedDate(即使沒 task selected),讓用戶可以「ESC 退回純日曆」
        if (calendarSelectedDate) { setCalendarSelectedDate(null); return; }
        if (isMobileSidebarOpen) { setIsMobileSidebarOpen(false); return; }
        if (batchMode) { exitBatchMode(); return; }
      }

      // Batch mode 熱鍵（Enter 完成 / Delete 刪除）
      if (batchMode && batchSelectedIds && batchSelectedIds.size > 0) {
        if (e.key === "Enter") { e.preventDefault(); handleBatchComplete(); }
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); handleBatchDelete(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSettingsOpen, isFlowTimerOpen, selectedTaskId, calendarSelectedTask, calendarSelectedDate, isMobileSidebarOpen, batchMode, batchSelectedIds, handleBatchComplete, handleBatchDelete, exitBatchMode]);

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

  const selectedTask = selectedTaskId ? (
    tasks.find((t) => t.id === selectedTaskId) ||
    Object.values(sharedLists).flatMap(listData => listData.tasks).find((t) => t.id === selectedTaskId) ||
    null
  ) : null;
  const calendarTask = currentView === 'calendar' ? calendarSelectedTask : null;
  const detailTask = calendarTask || selectedTask;

  const renderView = () => {
    switch (currentView) {
      case "calendar":
        return (
        <CalendarView
          key={getBfcacheKey()}
          selectedDate={calendarSelectedDate}
          onSelectDate={setCalendarSelectedDate}
          selectedTask={calendarSelectedTask}
          onSelectTask={(task) => {
            setCalendarSelectedTask(task);
          }}
          isMobile={isMobile}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
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
      case "command-center":
        return (
          <CommandCenter
            onClose={() => setCurrentView("inbox")}
          />
        );
      default:
        return (
          <AppShell
            selectedTaskId={selectedTaskId}
            onSelectTask={(id) => setSelectedTaskId((prev) => (prev === id ? null : id))}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenListForm={handleOpenListForm}
            onEditList={handleEditList}
            onDeleteList={deleteList}
            onOpenFlowTimer={() => setIsFlowTimerOpen(true)}
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

  // 月視圖模式 (§A9.3 合併):同一入口,內部 mode 切換
  // - mode="view"(預設)→ 戰報,看月視圖
  // - mode="plan"→ 沙盤,拖曳任務到日期
  // 不重設 view 內部 key(CalendarView selectedDate / CommandCenter 拖曳清單) → 切回來保留狀態
  const showMonthTabs = currentView === "calendar" || currentView === "command-center";
  const calendarMonthMode: "view" | "plan" = currentView === "command-center" ? "plan" : "view";

  const renderDetailPanel = () => (
    <AnimatePresence>
      {detailTask && (
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
          <TaskDetailPanel
            task={detailTask}
            onClose={() => { setSelectedTaskId(null); setCalendarSelectedTask(null); }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
  // ── Foreground Push Notification Toast ───────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "PUSH_RECEIVED") {
        toast(
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-sm">{event.data.title}</span>
            <span className="text-xs opacity-90">{event.data.body}</span>
          </div>,
          {
            duration: 4000,
            icon: "🔔",
          }
        );
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

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
          onOpenFlowTimer={() => setIsFlowTimerOpen(true)}
          onOpenShareModal={(list, listTasks) => setShareModalList({ list, tasks: listTasks })}
          onOpenSharedLists={() => setShowSharedLists(true)}
          onOpenSharedList={(sharedId) => { setCurrentSharedList(sharedId); }}
          onLeaveSharedList={handleLeaveSharedList}
        />
      </div>

      {/* Main content — flex column, AppShell scrolls within */}
      <div className="flex-1 min-w-0 flex flex-col pb-[calc(60px+env(safe-area-inset-bottom,0px)+12px)] md:pb-0">
        {/* Global Search Bar — rendered above all views so calendar/habits/tags/stats can search too */}
        <div className="hidden sm:flex justify-end px-4 md:px-6 pt-3 pb-1 flex-shrink-0">
          <GlobalSearchBar onSelectTask={(id) => setSelectedTaskId(id)} />
        </div>
        {isMobile ? (
          <PullToRefresh onRefresh={forceReload} className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              {showMonthTabs && (
                <MonthViewTabs mode={calendarMonthMode} onToggle={() => setCurrentView(calendarMonthMode === "plan" ? "calendar" : "command-center")} />
              )}
              {renderView()}
            </div>
          </PullToRefresh>
        ) : (
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {showMonthTabs && (
              <MonthViewTabs mode={calendarMonthMode} onToggle={() => setCurrentView(calendarMonthMode === "plan" ? "calendar" : "command-center")} />
            )}
            {renderView()}
          </div>
        )}
      </div>
      {/* Desktop: detail panel as fixed overlay (z-40, above sticky header z-30 §26 命中類別新:R)
          理由:之前用 flex sibling 將 detail panel 推到右側 480px,但 header 是 sticky top-0 z-30,
          詳情打開時 header 的「禪/蕃茄/新增」按鈕與 panel 標題列垂直重疊,視覺上看像 panel 被 header 蓋住。
          改 fixed 後 detail panel 獨立 z-stack(z-40),永遠壓過 header(z-30)。
          但加 backdrop 有副作用(會把整個畫面變暗),所以「禪/蕃茄/新增」仍可見但不可點。
          Mobile 仍維持原 fixed inset-0(z-60,純 full-screen overlay)。 */}
      {detailTask && !isMobile && currentView !== 'calendar' && (
        <AnimatePresence>
          <motion.div
            key="detail-panel-desktop"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-0 right-0 bottom-0 z-40 w-full md:w-[480px] border-l overflow-y-auto overscroll-contain shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
            role="dialog"
            aria-modal="false"
            aria-label="任務詳情面板"
          >
            <TaskDetailPanel
              task={detailTask}
              onClose={() => { setSelectedTaskId(null); setCalendarSelectedTask(null); }}
            />
          </motion.div>
        </AnimatePresence>
      )}
      {/* Mobile: full-screen overlay when task selected */}
      {detailTask && isMobile && renderDetailPanel()}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavigation
          currentView={currentView}
          currentListId={currentListId ?? null}
          lists={lists}
          tasks={tasks}
          onNavigate={(v) => setCurrentView(v)}
          onSelectList={(id) => setCurrentView("list", id)}
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenFlowTimer={() => setIsFlowTimerOpen(true)}
          onEditList={handleEditList}
          onDeleteList={deleteList}
          onOpenShareModal={(list, listTasks) => setShareModalList({ list, tasks: listTasks })}
          todayCount={viewCounts.today}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
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
              onOpenFlowTimer={() => { setIsMobileSidebarOpen(false); setIsFlowTimerOpen(true); }}
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

      <FlowTimerModal isOpen={isFlowTimerOpen} onClose={() => setIsFlowTimerOpen(false)} />

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

      {/* StatusWindow — 全域 RPG 狀態窗,跨頁面通用 */}
      <StatusWindow />

      {/* LevelUpNotification — 全域等級晉升動畫 */}
      <LevelUpNotification />

      </div>
    </>
  );
}

/**
 * MonthViewTabs — 月視圖單入口 + mode toggle (§A9.3 方案)
 *
 * 設計動機:
 * - 原本「戰報 / 沙盤」雙 tab 視覺同質,使用者反饋兩者長很像、感覺只須一個
 * - 合併為單一「月視圖」入口,內部用右上 icon button 切 mode
 *   - mode="view"(預設): 戰報 — 看月視圖、點日期看任務細節
 *   - mode="plan": 沙盤 — 拖曳 inbox 任務到日期
 * - 切換時不重設 view component 的 key → 兩 mode 的內部 state(選擇的日期、拖曳中任務)全保留
 *
 * 為什麼放 shell 而不放 view 內?
 * - CalendarView / CommandCenter 是獨立 component,mode 是 shell 概念(視覺層),不是 view 邏輯
 * - 放 shell 維持 component 職責分離(§5 DRY)
 */
function MonthViewTabs({
  mode,
  onToggle,
}: {
  mode: "view" | "plan";
  onToggle: () => void;
}) {
  const isPlan = mode === "plan";
  return (
    <div
      className="mx-4 md:mx-6 mt-2 mb-1 inline-flex items-center gap-2 self-start"
    >
      {/* 標題區塊 — 永遠顯示,建立「同一個東西」視覺一致感 */}
      <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 shadow-sm ring-1 ring-slate-200/60">
        <Calendar className="w-4 h-4 text-slate-500" aria-hidden />
        <span className="text-[13px] font-medium text-slate-700">月視圖</span>
        <span className={`text-[11px] ${isPlan ? "text-amber-600 font-medium" : "text-slate-400"}`}>
          {isPlan ? "排程模式 · 拖曳排程" : "月曆模式"}
        </span>
      </div>

      {/* mode toggle button — 右上 icon switch,符合「一個入口兩種動作」概念 */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlan ? "切換到月曆模式" : "切換到排程模式(拖曳排程)"}
        aria-pressed={isPlan}
        title={isPlan ? "切到月曆" : "切到排程"}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ring-1 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
          isPlan
            ? "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
            : "bg-white text-slate-500 ring-slate-200/60 hover:bg-slate-50 hover:text-slate-700"
        }`}
      >
        {isPlan ? <Eye className="w-4 h-4" aria-hidden /> : <Flame className="w-4 h-4" aria-hidden />}
      </button>
    </div>
  );
}

// ─── Root layout ───────────────────────────────────────────
// 純業務元件容器 — Provider 鏈已上移至 app/layout.tsx (見 AppProviders)
export function AppLayout() {
  return <AppLayoutInner />;
}
