"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAuth } from "firebase/auth";

// /diag 需要 runtime 訪問 Supabase / Firebase，不可在 build time prerender。
// 否則會觸發 @/lib/supabase 的 module top-level getSupabaseClient()，
// 在 build worker env 注入未到位時 throw Invalid supabaseUrl。
export const dynamic = "force-dynamic";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function runDiagnostics(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1) Supabase env
  results.push({
    name: "Supabase client 初始化",
    ok: isSupabaseConfigured(),
    detail: isSupabaseConfigured() ? "已建立 anon client" : "NEXT_PUBLIC_SUPABASE_URL 或 anon key 缺失",
  });

  // 2) shared_lists table 可讀？
  if (supabase) {
    try {
      const { error } = await supabase.from("shared_lists").select("id").limit(1);
      results.push({
        name: "shared_lists table 可訪問",
        ok: !error,
        detail: error
          ? `error: ${error.message} ${error.hint || ""} ${error.code || ""}`
          : "OK（可能是空表，但讀權限有）",
      });
    } catch (e: any) {
      results.push({ name: "shared_lists table 可訪問", ok: false, detail: String(e) });
    }

    try {
      const { error } = await supabase.from("shared_list_members").select("id").limit(1);
      results.push({
        name: "shared_list_members table 可訪問",
        ok: !error,
        detail: error ? `error: ${error.message} ${error.code || ""}` : "OK",
      });
    } catch (e: any) {
      results.push({ name: "shared_list_members table 可訪問", ok: false, detail: String(e) });
    }

    try {
      const { error } = await supabase.from("shared_tasks").select("id").limit(1);
      results.push({
        name: "shared_tasks table 可訪問",
        ok: !error,
        detail: error ? `error: ${error.message}` : "OK",
      });
    } catch (e: any) {
      results.push({ name: "shared_tasks table 可訪問", ok: false, detail: String(e) });
    }

    // 4) accept_invite RPC 是否存在？
    try {
      const { error } = await supabase.rpc("accept_invite", {
        sid: "00000000-0000-0000-0000-000000000000",
        uid: "diag",
        email: "diag@diag.com",
      });
      results.push({
        name: "accept_invite RPC 已建立",
        ok: true,
        detail: error
          ? `存在但呼叫失敗（符合預期：找不到邀請會 raise exception）— ${error.message}`
          : "OK（已接受）",
      });
    } catch (e: any) {
      // RPC not found => PGRST202 通常
      results.push({
        name: "accept_invite RPC 已建立",
        ok: !String(e).includes("not found"),
        detail: String(e?.message || e),
      });
    }
  }

  // 5) Firebase Auth
  try {
    const u = getAuth().currentUser;
    results.push({
      name: "Firebase Auth currentUser",
      ok: !!u,
      detail: u ? `uid=${u.uid} email=${u.email}` : "未登入 — 整個協作流程需要 Firebase UID 才能正確運作",
    });
  } catch (e: any) {
    results.push({ name: "Firebase Auth currentUser", ok: false, detail: String(e) });
  }

  return results;
}

export default function DiagPage() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults([]);
    const r = await runDiagnostics();
    setResults(r);
    setRunning(false);
  };

  useEffect(() => { void run(); }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">🩺 Shared List 健康檢查</h1>
          <p className="text-sm text-slate-500 mt-1">
            按下按鈕逐一檢查 Supabase 設定 + RLS + RPC + Firebase Auth
          </p>
        </header>

        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? "檢查中..." : "🔄 重新檢查"}
        </button>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y">
          {results.length === 0 && <div className="p-4 text-sm text-slate-500">尚未執行</div>}
          {results.map((r) => (
            <div key={r.name} className="flex items-start gap-3 p-4">
              <span
                className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                style={{
                  background: r.ok ? "#dcfce7" : "#fee2e2",
                  color: r.ok ? "#166534" : "#991b1b",
                }}
              >
                {r.ok ? "✓" : "✕"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-slate-500 mt-1 break-all">{r.detail}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-2">
          <h2 className="font-semibold">📌 失敗時的對應處置</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>「Supabase client 初始化」紅 → 檢查 .env.local 兩個 NEXT_PUBLIC_SUPABASE_*</li>
            <li>「shared_lists / shared_list_members / shared_tasks」任一紅 → <strong>SQL migration 還沒跑</strong>，打開 Supabase Dashboard → SQL Editor 依序跑 <code className="bg-slate-100 px-1 rounded">supabase/migrations/0001_shared_lists_v2.sql</code> 和 <code className="bg-slate-100 px-1 rounded">0002_accept_invite_rpc.sql</code></li>
            <li>「accept_invite RPC」紅 → 跑 <code className="bg-slate-100 px-1 rounded">0002_accept_invite_rpc.sql</code></li>
            <li>「Firebase Auth currentUser」紅 → 還沒登入，先用 Google 登入再來測</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
