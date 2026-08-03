"use client";

/**
 * /admin/shared-diag — 開發者診斷頁面:驗證 shared list 你的實際 role + DB 端 owner row 是否對齊 (2026-08-03)
 *
 * 觸發：owner 建立 shareList 後,ShareListModal 卻顯示「你目前是成員」,
 *       無法邀請成員。AppContext.tsx:1659-1667 useEffect 透過
 *       getMyRoleInSharedList(sid, user.uid) 查 shared_list_members
 *       寫進 myRoleByList。getMyRole 回傳 null = DB 端沒有對應 row。
 *
 * 本頁直接打 Supabase 查 raw 資料,確認：
 *   A) shared_lists.owner_uid 是否等於 auth.uid()
 *   B) shared_list_members 是否有對應的 owner role row (member_uid = auth.uid())
 *   C) row 的 member_uid / member_email / role / status 實際值
 *
 * 對齊既有 pattern (./shared-rpc-rollout/page.tsx)：
 *   - export const dynamic = "force-dynamic" (避免 build prerender)
 *   - useAuth() gate 限制 isAdmin 才能看
 *   - getSupabaseClient() 拿 supabase client
 */

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface MemberRow {
  shared_list_id: string;
  member_email: string;
  member_uid: string;
  role: string;
  status: string;
  accepted_at?: string | null;
  invited_at?: string | null;
}

interface SharedListRow {
  id: string;
  owner_uid: string;
  owner_email: string;
  name: string;
  created_at?: string;
}

interface SharedListDiag {
  list: SharedListRow;
  isYouOwner: boolean;
  members: MemberRow[];
  yourRole: string | null;
  yourRowCount: number;
}

export default function SharedDiagPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [diags, setDiags] = useState<SharedListDiag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ranOnce, setRanOnce] = useState(false);

  const runDiag = async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabaseClient();
      if (!sb) {
        setError("Supabase client 未建立,檢查 NEXT_PUBLIC_SUPABASE_URL / anon key");
        setLoading(false);
        return;
      }
      const { data: authData } = await sb.auth.getUser();
      const uid = authData?.user?.id ?? null;
      const email = authData?.user?.email ?? null;
      setAuthUid(uid);
      setAuthEmail(email);

      const { data: lists, error: listsErr } = await sb
        .from("shared_lists")
        .select("id, owner_uid, owner_email, name, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (listsErr) {
        setError("shared_lists query 失敗:" + listsErr.message);
        setLoading(false);
        return;
      }

      const allLists = (lists ?? []) as SharedListRow[];
      const ids = allLists.map((l) => l.id);

      const { data: members, error: memErr } = await sb
        .from("shared_list_members")
        .select(
          "shared_list_id, member_email, member_uid, role, status, accepted_at, invited_at"
        )
        .in("shared_list_id", ids);

      if (memErr) {
        setError("shared_list_members query 失敗:" + memErr.message);
        setLoading(false);
        return;
      }

      const allMembers = (members ?? []) as MemberRow[];

      const results: SharedListDiag[] = allLists.map((list) => {
        const ms = allMembers.filter((m) => m.shared_list_id === list.id);
        const yourRows = uid ? ms.filter((m) => m.member_uid === uid) : [];
        const yourActive = yourRows.find((m) => m.status === "active");
        return {
          list,
          isYouOwner: list.owner_uid === uid,
          members: ms,
          yourRole: yourActive ? yourActive.role : null,
          yourRowCount: yourRows.length,
        };
      });

      setDiags(results);
      setRanOnce(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("exception:" + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && isSupabaseConfigured()) {
      void runDiag();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">🔒 Admin only</h1>
          <p className="text-slate-600">此頁僅限開發者診斷使用。</p>
        </div>
      </div>
    );
  }

  const youOwnCount = diags.filter((d) => d.isYouOwner).length;
  const youOwnerHasRow = diags.filter(
    (d) => d.isYouOwner && d.yourRowCount > 0
  ).length;
  const youOwnerMissingRow = diags.filter(
    (d) => d.isYouOwner && d.yourRowCount === 0
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">
            🔧 Shared List 診斷 (owner role 不一致調查)
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            直接查 Supabase raw 資料,確認「你是 owner 的清單」是否在
            <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs">
              shared_list_members
            </code>
            有對應的
            <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs">
              role=owner
            </code>
            row。
          </p>
        </header>

        <section className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">你目前的 Auth 身份</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Supabase auth.uid():</dt>
            <dd className="font-mono text-slate-800 break-all">{authUid ?? "—"}</dd>
            <dt className="text-slate-500">Email:</dt>
            <dd className="font-mono text-slate-800 break-all">{authEmail ?? "—"}</dd>
            <dt className="text-slate-500">App user.uid:</dt>
            <dd className="font-mono text-slate-800 break-all">{user?.uid ?? "—"}</dd>
            <dt className="text-slate-500">isAdmin:</dt>
            <dd className="font-mono text-slate-800">{String(isAdmin)}</dd>
          </dl>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">總覽</h2>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="你 owner 的清單數" value={youOwnCount} />
            <Stat label="DB 有對應 owner row" value={youOwnerHasRow} good={true} />
            <Stat
              label="DB 缺 owner row (❌ bug)"
              value={youOwnerMissingRow}
              danger={youOwnerMissingRow > 0}
            />
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}
        </section>

        <button
          onClick={runDiag}
          disabled={loading}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={14} />
          {loading ? "查詢中..." : "重新查詢"}
        </button>

        {ranOnce && diags.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-5 text-sm text-slate-600">
            沒有任何 shared_lists 資料。
          </div>
        )}

        <div className="space-y-3">
          {diags.map((d) => (
            <ListCard key={d.list.id} diag={d} authUid={authUid} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  good,
  danger,
}: {
  label: string;
  value: number;
  good?: boolean;
  danger?: boolean;
}) {
  const color = good
    ? "text-emerald-700 bg-emerald-50"
    : danger
      ? "text-red-700 bg-red-50"
      : "text-slate-700 bg-slate-50";
  return (
    <div className={`rounded-md p-3 ${color}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs mt-1">{label}</div>
    </div>
  );
}

function ListCard({ diag, authUid }: { diag: SharedListDiag; authUid: string | null }) {
  const ownerOk = diag.isYouOwner && diag.yourRowCount > 0;
  const ownerMissing = diag.isYouOwner && diag.yourRowCount === 0;
  const notYourList = !diag.isYouOwner;

  const headerColor = ownerMissing
    ? "bg-red-50 border-red-200"
    : ownerOk
      ? "bg-emerald-50 border-emerald-200"
      : "bg-slate-50 border-slate-200";

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${headerColor} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            {diag.list.name}
          </h3>
          <p className="text-xs text-slate-500 font-mono mt-1 break-all">
            sid: {diag.list.id}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {ownerMissing && (
            <span className="inline-flex items-center gap-1 text-xs text-red-700">
              <XCircle size={14} />
              ❌ Owner row 缺失
            </span>
          )}
          {ownerOk && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 size={14} />
              Owner row OK
            </span>
          )}
          {notYourList && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <AlertTriangle size={14} />
              你不是這個清單的 owner
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-1 text-xs mb-3">
        <dt className="text-slate-500">shared_lists.owner_uid:</dt>
        <dd className="font-mono text-slate-800 break-all">
          {diag.list.owner_uid}
          {diag.isYouOwner && (
            <span className="ml-2 text-emerald-600">= 你 ✅</span>
          )}
        </dd>
        <dt className="text-slate-500">shared_lists.owner_email:</dt>
        <dd className="font-mono text-slate-800 break-all">
          {diag.list.owner_email}
        </dd>
        <dt className="text-slate-500">你的 auth.uid():</dt>
        <dd className="font-mono text-slate-800 break-all">
          {authUid ?? "—"}
        </dd>
        <dt className="text-slate-500">推斷你的 role (active):</dt>
        <dd className="font-mono text-slate-800">
          {diag.yourRole ?? "— (沒查到)"}
        </dd>
      </dl>

      <details className="text-xs">
        <summary className="cursor-pointer text-slate-600 hover:text-slate-800">
          shared_list_members ({diag.members.length} row{diag.members.length !== 1 ? "s" : ""})
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1 pr-2">role</th>
                <th className="py-1 pr-2">status</th>
                <th className="py-1 pr-2">member_uid</th>
                <th className="py-1 pr-2">member_email</th>
                <th className="py-1 pr-2">?</th>
              </tr>
            </thead>
            <tbody>
              {diag.members.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-slate-400 italic">
                    沒有任何 member row
                  </td>
                </tr>
              )}
              {diag.members.map((m, i) => {
                const isYou = m.member_uid === authUid;
                return (
                  <tr
                    key={`${m.shared_list_id}-${i}`}
                    className={`border-b border-slate-100 ${isYou ? "bg-yellow-50" : ""}`}
                  >
                    <td className="py-1 pr-2 font-mono">{m.role}</td>
                    <td className="py-1 pr-2 font-mono">{m.status}</td>
                    <td className="py-1 pr-2 font-mono break-all">
                      {m.member_uid}
                    </td>
                    <td className="py-1 pr-2 font-mono">{m.member_email}</td>
                    <td className="py-1 pr-2">
                      {isYou && <span className="text-yellow-700">← 你</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}