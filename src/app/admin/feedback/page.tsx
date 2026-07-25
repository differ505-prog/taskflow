"use client";

/**
 * /admin/feedback — 開發者後台:用戶反饋管理(§A 修正後新增)
 *
 * 設計動機:
 *   前版 FeedbackButton 把「複製 + AI 整理」放在使用者 modal(開發者功能誤放使用者路徑)。
 *   本頁是真正的「開發者後台」,提供:
 *     - 全部反饋列表(realtime 訂閱,新反饋即時出現)
 *     - 篩選:全部 / 新 / 已看 / 歸檔 / 假訊號
 *     - 多選 + 「📋 複製 + AI 整理」bar → 組裝成完整 prompt markdown 貼到 Cursor / Claude
 *     - 單筆 status 切換(reviewed / archived / spurious)
 *
 * 對齊既有 pattern(§25):
 *   - supabase client 從 getSupabaseClient() 拿(對齊 personalTaskSync / sharedSync)
 *   - admin gate 對齊 ProtectedUploadButton 的 useAuth().isAdmin 模式
 *   - PageHeader + UserMenu 直接 reuse(§25 reuse)
 *   - motion + AnimatePresence 對齊 FeedbackButton 風格
 *
 * 反覆根因預防(§26):
 *   - §M Provider 旁路:useAuth 在 root layout 已 mount,本頁直接用即可,不再包 Provider
 *   - §O' 雙 hook 死鎖:篩選 / 勾選 / 展開是 3 個獨立 useState,不混用
 *   - §P 雙 persona UI 混用:本頁只在 /admin/* 路由 mount,不被 FeedbackButton 等使用者元件引用
 *   - §L clipboard:複製走 feedbackAdmin.copyToClipboard(已含 fallback)
 *   - §K realtime:Supabase Realtime 訂閱(瀏覽器 sub,需在線),斷線時 polling fallback 不在本期範圍
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardCopy,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldOff,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { getSupabaseClient } from "@/lib/supabase";
import {
  buildFeedbackMarkdown,
  copyToClipboard,
  FILTER_OPTIONS,
  STATUS_LABEL,
  type FeedbackFilter,
  type FeedbackRow,
} from "@/lib/feedbackAdmin";
import PageHeader from "@/components/PageHeader";
import { UserMenu } from "@/components/UserMenu";

export default function AdminFeedbackPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [filter, setFilter] = useState<FeedbackFilter>("new");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const realtimeChannelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]> | null>(null);

  // ── 初始載入 + realtime 訂閱 ─────────────────────────────────────
  const loadRows = useCallback(async (showSpinner = false) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase 未設定,無法讀取反饋");
      setLoading(false);
      return;
    }
    if (showSpinner) setRefreshing(true);
    const { data, error } = await supabase
      .from("feedback")
      .select("id, user_id, user_email, user_role, message, context, status, category, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[admin/feedback] load failed:", error);
      toast.error("讀取反饋失敗:" + error.message);
    } else {
      setRows((data ?? []) as FeedbackRow[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    void loadRows();
    // realtime 訂閱(§K:瀏覽器需在線,Supabase 透過 websocket push 新事件)
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const channel = supabase
      .channel("admin-feedback-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as FeedbackRow;
            setRows((prev) => [newRow, ...prev.filter((r) => r.id !== newRow.id)]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as FeedbackRow;
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as { id: string };
            setRows((prev) => prev.filter((r) => r.id !== removed.id));
          }
        }
      )
      .subscribe();
    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) {
        void realtimeChannelRef.current.unsubscribe();
        realtimeChannelRef.current = null;
      }
    };
  }, [authLoading, isAdmin, loadRows]);

  // ── 篩選後的列表 ──────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  // ── 切換單筆 status ────────────────────────────────────────────
  const updateStatus = useCallback(async (id: string, status: FeedbackRow["status"]) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const prev = rows.find((r) => r.id === id)?.status;
    // 樂觀更新
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase
      .from("feedback")
      .update({ status })
      .eq("id", id);
    if (error) {
      console.error("[admin/feedback] status update failed:", error);
      toast.error("狀態更新失敗:" + error.message);
      // rollback
      if (prev) setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: prev } : r)));
    }
  }, [rows]);

  // ── 勾選切換 ───────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredRows.map((r) => r.id)));
  }, [filteredRows]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── 批次複製 ───────────────────────────────────────────────────
  const handleCopySelected = useCallback(async () => {
    const selected = rows.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) {
      toast.error("請先勾選反饋");
      return;
    }
    const markdown = buildFeedbackMarkdown(selected);
    const ok = await copyToClipboard(markdown);
    if (ok) {
      toast.success(`已複製 ${selected.length} 筆反饋 ✨ — 貼到 Cursor / Claude 即可整理`);
    } else {
      toast.error("複製失敗,請手動選取");
    }
  }, [rows, selectedIds]);

  // ── Admin gate ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--text-secondary)" }}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!isAdmin || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
        >
          <ShieldOff className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--status-warning)" }} />
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            沒有權限
          </h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            後台僅供 Admin 存取。如需權限,請聯絡 owner。
          </p>
        </div>
      </main>
    );
  }

  const newCount = rows.filter((r) => r.status === "new").length;
  const selectedCount = selectedIds.size;

  return (
    <main className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
      <PageHeader icon={MessageSquare} title="反饋後台" backHref="/">
        <UserMenu />
      </PageHeader>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            {FILTER_OPTIONS.map((opt) => {
              const count = opt.value === "all" ? rows.length : rows.filter((r) => r.status === opt.value).length;
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-200 ease-out active:scale-[0.98]"
                  style={{
                    background: active ? "var(--brand)" : "transparent",
                    color: active ? "var(--brand-foreground)" : "var(--text-secondary)",
                  }}
                >
                  {opt.label}
                  <span className="ml-1.5 text-[10.5px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void loadRows(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-200 hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            重新整理
          </button>
          <div className="flex-1" />
          {newCount > 0 && filter !== "new" && (
            <span className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              {newCount} 則新反饋待處理
            </span>
          )}
        </div>

        {/* Batch action bar — 勾選後顯示 */}
        <AnimatePresence>
          {selectedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 px-4 py-2.5 mb-3 rounded-xl"
              style={{ background: "var(--brand-tint)", border: "1px solid var(--brand)" }}
            >
              <span className="text-[12.5px] font-medium" style={{ color: "var(--brand)" }}>
                已選 {selectedCount} 筆
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[11.5px] px-2 py-0.5 rounded transition-colors hover:bg-black/5"
                style={{ color: "var(--text-secondary)" }}
              >
                清除
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => selectAllFiltered()}
                className="text-[11.5px] px-2 py-0.5 rounded transition-colors hover:bg-black/5"
                style={{ color: "var(--text-secondary)" }}
              >
                全選當前篩選
              </button>
              <button
                type="button"
                onClick={() => void handleCopySelected()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
              >
                <ClipboardCopy className="w-3.5 h-3.5" aria-hidden="true" />
                複製 + AI 整理
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <ul className="space-y-2">
            {filteredRows.map((row) => (
              <FeedbackItem
                key={row.id}
                row={row}
                selected={selectedIds.has(row.id)}
                expanded={expandedId === row.id}
                onToggleSelect={() => toggleSelect(row.id)}
                onToggleExpand={() => setExpandedId(expandedId === row.id ? null : row.id)}
                onUpdateStatus={(s) => void updateStatus(row.id, s)}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function FeedbackItem({
  row,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onUpdateStatus,
}: {
  row: FeedbackRow;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onUpdateStatus: (s: FeedbackRow["status"]) => void;
}) {
  const statusLabel = STATUS_LABEL[row.status];
  const ctx = (row.context ?? {}) as Partial<{
    route: string;
    appVersion: string;
    recentConsoleErrors: number;
    collectedAt: string;
    lastActions: Array<{ type?: string; payload?: unknown; ts?: string }>;
    lastConsoleErrors: Array<{ level?: string; message?: string; ts?: string }>;
  }>;

  return (
    <li
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: "var(--surface-elevated)",
        border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`選取反饋 ${row.id.slice(0, 8)}`}
          className="mt-1 w-4 h-4 rounded accent-[var(--brand)] cursor-pointer flex-shrink-0"
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 text-left min-w-0"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold flex-shrink-0"
              style={{ background: "var(--brand-tint)", color: statusLabel.tone }}
            >
              {statusLabel.label}
            </span>
            <span className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
              {row.user_email ?? "訪客"} ({row.user_role ?? "free"})
            </span>
            <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
              {formatTime(row.created_at)}
            </span>
          </div>
          <p
            className="text-[13.5px] leading-relaxed"
            style={{ color: "var(--text-primary)", wordBreak: "break-word" }}
          >
            {row.message || <span style={{ color: "var(--text-tertiary)" }}>(無訊息)</span>}
          </p>
          {ctx.route && (
            <div className="mt-1.5 text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
              <Tag className="w-3 h-3 inline-block mr-1 -mt-0.5" aria-hidden="true" />
              {ctx.route}
              {ctx.recentConsoleErrors !== undefined && ctx.recentConsoleErrors > 0 && (
                <span className="ml-2" style={{ color: "var(--status-warning)" }}>
                  {ctx.recentConsoleErrors} console error
                </span>
              )}
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-black/5"
          aria-label={expanded ? "收合" : "展開"}
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          )}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
              {/* Status actions */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  標記狀態:
                </span>
                {(["new", "reviewed", "archived", "spurious"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onUpdateStatus(s)}
                    disabled={row.status === s}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: row.status === s ? "var(--brand-tint)" : "transparent",
                      color: row.status === s ? "var(--brand)" : "var(--text-secondary)",
                      border: `1px solid ${row.status === s ? "var(--brand)" : "var(--border)"}`,
                    }}
                  >
                    {STATUS_LABEL[s].label}
                  </button>
                ))}
              </div>

              {/* Context JSON */}
              <details className="text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
                <summary className="cursor-pointer hover:underline select-none">完整 context JSON</summary>
                <pre
                  className="mt-2 p-3 rounded-lg text-[10.5px] overflow-x-auto"
                  style={{
                    background: "var(--surface-muted)",
                    color: "var(--text-primary)",
                    maxWidth: "100%",
                  }}
                >
                  {JSON.stringify(row.context, null, 2)}
                </pre>
              </details>

              {/* 動作序列 */}
              {ctx.lastActions && ctx.lastActions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    最後操作 ({ctx.lastActions.length})
                  </p>
                  <ul className="space-y-0.5 text-[10.5px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                    {ctx.lastActions.slice(-5).map((a, i) => (
                      <li key={i} className="truncate">
                        {a.ts ?? ""} · {a.type ?? "?"} · {JSON.stringify(a.payload ?? {}).slice(0, 100)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Console errors */}
              {ctx.lastConsoleErrors && ctx.lastConsoleErrors.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--status-warning)" }}>
                    最近 console errors ({ctx.lastConsoleErrors.length})
                  </p>
                  <ul className="space-y-0.5 text-[10.5px] font-mono" style={{ color: "var(--status-danger)" }}>
                    {ctx.lastConsoleErrors.slice(-5).map((e, i) => (
                      <li key={i} className="break-words">
                        [{e.level ?? "log"}] {e.message ?? ""} {e.ts ? `@ ${e.ts}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Meta */}
              <div className="mt-3 text-[10.5px] space-y-0.5" style={{ color: "var(--text-tertiary)" }}>
                <p>id: <span className="font-mono">{row.id}</span></p>
                <p>updated_at: <span className="font-mono">{row.updated_at}</span></p>
                {ctx.appVersion && <p>app_version: <span className="font-mono">{ctx.appVersion}</span></p>}
                {ctx.collectedAt && <p>collected_at: <span className="font-mono">{ctx.collectedAt}</span></p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function EmptyState({ filter }: { filter: FeedbackFilter }) {
  const isAll = filter === "all";
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-2xl"
      style={{ background: "var(--surface-elevated)", border: "1px dashed var(--border)" }}
    >
      <MessageSquare className="w-10 h-10 mb-3 opacity-30" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
      <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {isAll ? "目前沒有任何反饋" : `沒有「${STATUS_LABEL[filter].label}」狀態的反饋`}
      </p>
      <p className="text-[11.5px] mt-1" style={{ color: "var(--text-tertiary)" }}>
        使用者送出後會即時出現在這裡
      </p>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "剛剛";
    if (diffMin < 60) return `${diffMin} 分前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小時前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} 天前`;
    return d.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
  } catch {
    return iso;
  }
}
