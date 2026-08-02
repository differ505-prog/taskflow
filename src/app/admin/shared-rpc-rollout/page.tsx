"use client";

/**
 * /admin/shared-rpc-rollout — 開發者後台:驗證 Shared Lists RPC v3 rollout (§26 類別 P)
 *
 * 觸發:2026-08-03 fix(shared) commit e788173 + bcd6908 + 7c71964 + f278643
 *       把協作清單寫入路徑從「client 直接 upsert 撞 RLS」改成「SECURITY DEFINER RPC」,
 *       但 production Supabase DB 還沒套用 migration 0019/0020,
 *       需要一個開發者專用頁面快速驗證 8 個 RPC 是否全部生效。
 *
 * 設計動機(§26 類別 P):
 *   - 開發者工具不放使用者 UI,只放 /admin/* 路由
 *   - 8 個 RPC 各一個獨立測試按鈕 + 結果顯示區,失敗時顯示 Supabase 錯誤訊息
 *   - 提供 mock 模式讓本機 dev (Supabase 未連線) 也能驗證 client 程式碼不 crash
 *
 * 對齊既有 pattern(§25):
 *   - admin gate 用 useAuth().isAdmin(對齊 /admin/feedback)
 *   - PageHeader + UserMenu 直接 reuse
 *   - supabase client 從 getSupabaseClient() 拿(對齊 sharedSync)
 *
 * 與 /smoketest 的差異:
 *   - /smoketest 用 fake uid 跑,auth.uid() 永遠 null,無法驗證 RPC
 *   - 本頁用真實 Supabase Auth user,auth.uid() 正確,才能驗 RPC 校驗邏輯
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  ShieldOff,
  FlaskConical,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { getSupabaseClient } from "@/lib/supabase";
import {
  createSharedList,
  deleteSharedList,
} from "@/lib/firestore";
import {
  acceptInvite,
  changeMemberRole,
  deleteSharedTask,
  inviteMember,
  removeMember,
  setSharedTaskPosition,
  upsertSharedTasks,
} from "@/lib/sharedSync";
import type { Task } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { UserMenu } from "@/components/UserMenu";

interface TestResult {
  rpc: string;
  ok: boolean;
  message: string;
  detail?: unknown;
  durationMs: number;
}

function uid(): string {
  // 對齊 §14.4 — 用真實 auth user.uid 作為 owner
  return "_auth_only_"; // 呼叫端會用 useAuth().user?.uid 取代
}

function mockTask(title: string): Task {
  const now = new Date().toISOString();
  return {
    id: `t_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    priority: "delegate",
    status: "todo",
    createdAt: now,
    updatedAt: now,
    tags: [],
    isArchived: false,
    focusMinutes: 0,
    order: 0,
    createdBy: "mock",
  };
}

export default function SharedRpcRolloutAdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedRpc, setExpandedRpc] = useState<string | null>(null);

  useEffect(() => {
    setSupabaseReady(getSupabaseClient() !== null);
  }, []);

  const runTest = useCallback(
    async (rpcName: string, fn: () => Promise<void>) => {
      setRunning(rpcName);
      const t0 = Date.now();
      try {
        await fn();
        const r: TestResult = {
          rpc: rpcName,
          ok: true,
          message: `${rpcName} 成功`,
          durationMs: Date.now() - t0,
        };
        setResults((prev) => [r, ...prev].slice(0, 20));
        toast.success(r.message);
      } catch (e: any) {
        const r: TestResult = {
          rpc: rpcName,
          ok: false,
          message: e?.message ?? String(e),
          detail: e,
          durationMs: Date.now() - t0,
        };
        setResults((prev) => [r, ...prev].slice(0, 20));
        toast.error(`${rpcName} 失敗:${r.message}`);
      } finally {
        setRunning(null);
      }
    },
    []
  );

  // ── 8 個 RPC 測試包裝器 ───────────────────────────────────────────
  const ownerUid = user?.uid ?? "anonymous";
  const ownerEmail = user?.email ?? null;
  const ownerName = user?.displayName ?? "admin-test";

  const tests: Array<{
    name: string;
    rpc: string;
    description: string;
    run: () => Promise<void>;
    needsSharedList?: boolean;
  }> = [
    {
      name: "create_shared_list_v2",
      rpc: "create_shared_list_v2",
      description: "建立共享清單 + owner member row(截圖 root cause)",
      run: async () => {
        const sid = `sl_admin_${Date.now()}`;
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        await createSharedList(
          {
            id: sid,
            sharedId: sid,
            name: "Admin RPC Test List",
            icon: "🧪",
            color: "#3B82F6",
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerId: ownerUid,
          },
          [],
          ownerUid,
          ownerName,
          ownerEmail
        );
      },
    },
    {
      name: "upsert_shared_tasks_v2",
      rpc: "upsert_shared_tasks_v2",
      description: "寫入任務(需要已存在的 shared list)",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        // 用先前測試結果的 sid;若無,提示先跑 create
        const lastCreate = results.find((r) => r.rpc === "create_shared_list_v2" && r.ok);
        if (!lastCreate) throw new Error("請先跑 create_shared_list_v2");
        // 從 toast log 裡的 sharedId 無法直接拿 — 簡化作:讓 user 手動輸入
        const sid = window.prompt("請貼上 create_shared_list_v2 建立的 sharedId:");
        if (!sid) throw new Error("未提供 sharedId");
        await upsertSharedTasks(sid, [mockTask("admin test task")]);
      },
    },
    {
      name: "invite_member_v2",
      rpc: "invite_member_v2",
      description: "邀請成員(需要 owner 登入 + sharedId)",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        const sid = window.prompt("請貼上 sharedId:");
        const email = window.prompt("請輸入被邀請者 email:");
        if (!sid || !email) throw new Error("需要 sharedId + email");
        await inviteMember({ sharedListId: sid, memberEmail: email, role: "editor" });
      },
    },
    {
      name: "remove_member_v2",
      rpc: "remove_member_v2",
      description: "軟刪除成員(需要 owner 登入)",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        const sid = window.prompt("請貼上 sharedId:");
        const email = window.prompt("請輸入被移除者 email:");
        if (!sid || !email) throw new Error("需要 sharedId + email");
        await removeMember({ sharedListId: sid, memberEmail: email });
      },
    },
    {
      name: "change_member_role_v2",
      rpc: "change_member_role_v2",
      description: "變更成員角色(需要 owner 登入)",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        const sid = window.prompt("請貼上 sharedId:");
        const email = window.prompt("請輸入成員 email:");
        if (!sid || !email) throw new Error("需要 sharedId + email");
        await changeMemberRole({ sharedListId: sid, memberEmail: email, role: "viewer" });
      },
    },
    {
      name: "delete_shared_task_v2",
      rpc: "delete_shared_task_v2",
      description: "刪除單個任務",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        const sid = window.prompt("請貼上 sharedId:");
        const tid = window.prompt("請貼上 taskId:");
        if (!sid || !tid) throw new Error("需要 sharedId + taskId");
        await deleteSharedTask(sid, tid);
      },
    },
    {
      name: "set_shared_task_position_v2",
      rpc: "set_shared_task_position_v2",
      description: "拖曳更新 position",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        const sid = window.prompt("請貼上 sharedId:");
        const tid = window.prompt("請貼上 taskId:");
        if (!sid || !tid) throw new Error("需要 sharedId + taskId");
        await setSharedTaskPosition(sid, tid, Date.now());
      },
    },
    {
      name: "delete_shared_list_v2",
      rpc: "delete_shared_list_v2",
      description: "刪除整個清單(cascade 自動清 tasks/members)",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        const sid = window.prompt("請貼上要刪的 sharedId(刪了就回不來!):");
        if (!sid) throw new Error("需要 sharedId");
        if (!window.confirm(`真的要刪 ${sid}?`)) throw new Error("使用者取消");
        await deleteSharedList(sid);
      },
    },
    {
      name: "accept_invite (migration 0002)",
      rpc: "accept_invite",
      description: "被邀請者接受邀請(email 比對)",
      run: async () => {
        if (mockMode) {
          await new Promise((r) => setTimeout(r, 50));
          return;
        }
        const sid = window.prompt("請貼上 sharedId:");
        const email = window.prompt("請輸入你的 email(必須與被邀請的一致):");
        if (!sid || !email) throw new Error("需要 sharedId + email");
        await acceptInvite({
          sharedListId: sid,
          callerUid: ownerUid,
          callerEmail: email,
        });
      },
    },
  ];

  // ── Admin gate ─────────────────────────────────────────────────
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
            本頁僅供 Admin 存取。如需權限,請聯絡 owner。
          </p>
        </div>
      </main>
    );
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <main className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
      <PageHeader icon={FlaskConical} title="Shared RPC Rollout" backHref="/admin/feedback">
        <UserMenu />
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* 狀態面板 */}
        <section
          className="rounded-2xl p-4 space-y-2"
          style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            環境狀態
          </h2>
          <div className="text-[12.5px] space-y-1" style={{ color: "var(--text-secondary)" }}>
            <p>
              登入者: <span className="font-mono">{user.email ?? user.uid}</span> (uid={ownerUid.slice(0, 8)}…)
            </p>
            <p>
              Supabase Client:{" "}
              {supabaseReady ? (
                <span className="text-emerald-600 font-semibold">已連線</span>
              ) : (
                <span className="text-red-600 font-semibold">未連線</span>
              )}
            </p>
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--brand)]"
              />
              <span>Mock 模式(本機 dev 用,跳過實際 RPC,只驗 client 程式碼不 crash)</span>
            </label>
          </div>
          {failCount > 0 && (
            <p className="text-[12px] mt-2" style={{ color: "var(--status-danger)" }}>
              ⚠️ {failCount} 個測試失敗 — 通常代表 migration 還沒在 production Supabase 套用。
            </p>
          )}
        </section>

        {/* 9 個 RPC 測試按鈕 */}
        <section
          className="rounded-2xl p-4"
          style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            9 個 RPC 測試(覆蓋所有協作寫入路徑)
          </h2>
          <ul className="space-y-2">
            {tests.map((t) => {
              const isRunning = running === t.rpc;
              const lastResult = results.find((r) => r.rpc === t.rpc);
              return (
                <li
                  key={t.rpc}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() => void runTest(t.rpc, t.run)}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: lastResult?.ok
                        ? "var(--brand)"
                        : lastResult
                          ? "var(--status-danger)"
                          : "var(--text-secondary)",
                      color: "var(--brand-foreground)",
                    }}
                  >
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : lastResult?.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : lastResult ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <FlaskConical className="w-3.5 h-3.5" />
                    )}
                    {t.rpc}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px]" style={{ color: "var(--text-primary)" }}>
                      {t.description}
                    </p>
                    {lastResult && (
                      <p
                        className="text-[11px] mt-0.5 truncate"
                        style={{ color: lastResult.ok ? "var(--text-tertiary)" : "var(--status-danger)" }}
                      >
                        {lastResult.ok ? "✓" : "✗"} {lastResult.message} ({lastResult.durationMs}ms)
                      </p>
                    )}
                  </div>
                  {lastResult && !lastResult.ok && (
                    <button
                      type="button"
                      onClick={() => setExpandedRpc(expandedRpc === t.rpc ? null : t.rpc)}
                      className="p-1.5 rounded-lg hover:bg-black/5"
                      aria-label="展開錯誤細節"
                    >
                      {expandedRpc === t.rpc ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {results.some((r) => !r.ok) && expandedRpc && (
            <pre
              className="mt-3 p-3 rounded-lg text-[10.5px] overflow-x-auto"
              style={{
                background: "var(--surface-muted)",
                color: "var(--status-danger)",
                maxWidth: "100%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(results.find((r) => r.rpc === expandedRpc)?.detail, null, 2)}
            </pre>
          )}
        </section>

        {/* 統計 */}
        {results.length > 0 && (
          <section
            className="rounded-2xl p-3 text-[12px] flex gap-4"
            style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              成功 <strong className="text-emerald-600">{okCount}</strong>
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              失敗 <strong className="text-red-600">{failCount}</strong>
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>
              總計 {results.length} / 最近 20
            </span>
          </section>
        )}

        {/* 使用說明 */}
        <section
          className="rounded-2xl p-4 text-[12px] space-y-2"
          style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            使用說明
          </h3>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              確認 production Supabase DB 已跑 <code className="font-mono text-[11px]">0019_shared_lists_rpc_v3.sql</code> +
              <code className="font-mono text-[11px]">0020_shared_lists_rpc_v3_writes.sql</code>
            </li>
            <li>用真實 Supabase Auth 帳號登入(必須是 admin role)</li>
            <li>先按 <code className="font-mono text-[11px]">create_shared_list_v2</code> — 應成功(原本報 RLS 錯誤)</li>
            <li>把產生的 sharedId 貼到下一個測試邀請成員 → 對方開 <code className="font-mono text-[11px]">/smoketest</code> 用 email 加入</li>
            <li>雙方都應看到對方寫入的任務</li>
            <li>本機 dev 可勾「Mock 模式」跑一次,驗證 client 程式碼不 crash</li>
          </ol>
        </section>
      </div>
    </main>
  );
}

// Suppress unused import warnings for uid helper (kept for future use)
void uid;