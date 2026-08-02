/**
 * progressRankSync.ts — Pro 等級進度的 Supabase 同步層
 *
 * 取代 useProgressStatus 的 localStorage 寫入，解決跨裝置不同步問題。
 *
 * 用法：
 *   loadTotalPp(uid)          → 一次性讀取 total_pp
 *   saveTotalPp(uid, value)   → upsert 單筆（client-side 樂觀更新 + 背景推送）
 *   subscribeTotalPp(uid, cb) → Realtime 訂閱其他裝置的變更
 *
 * Schema：見 supabase/migrations/20260802_user_progress.sql
 *   table: user_progress
 *     owner_uid  text primary key
 *     total_pp   integer not null default 0 check (total_pp >= 0)
 *     updated_at timestamptz not null default now()
 *   RLS：owner_uid = auth.uid()::text 限本機讀寫
 */
import { supabase } from "./supabase";

const TABLE = "user_progress";

export type Unsubscribe = () => void;

export async function loadTotalPp(uid: string): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("total_pp")
      .eq("owner_uid", uid)
      .maybeSingle();
    if (error) {
      console.warn("[progressRankSync] loadTotalPp error:", error.message);
      return 0;
    }
    return typeof data?.total_pp === "number" ? data.total_pp : 0;
  } catch (err) {
    console.warn("[progressRankSync] loadTotalPp threw:", err);
    return 0;
  }
}

export async function saveTotalPp(uid: string, totalPp: number): Promise<void> {
  if (!supabase) return;
  const safe = Math.max(0, Math.floor(totalPp));
  try {
    const { error } = await supabase.from(TABLE).upsert(
      {
        owner_uid: uid,
        total_pp: safe,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_uid" },
    );
    if (error) console.warn("[progressRankSync] saveTotalPp error:", error.message);
  } catch (err) {
    console.warn("[progressRankSync] saveTotalPp threw:", err);
  }
}

/**
 * 即時訂閱 total_pp 變更 — 跨裝置推送
 * 任何裝置寫入都會觸發 onUpdate 回呼
 */
export async function subscribeTotalPp(
  uid: string,
  onUpdate: (totalPp: number) => void,
): Promise<Unsubscribe> {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`progress_rank:${uid}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: TABLE,
        filter: `owner_uid=eq.${uid}`,
      },
      (payload) => {
        const next = (payload.new as { total_pp?: unknown })?.total_pp;
        if (typeof next === "number" && Number.isFinite(next) && next >= 0) {
          onUpdate(next);
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}