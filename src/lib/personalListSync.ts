/**
 * personalListSync.ts — 個人清單同步（取代 Firebase lists collection）
 */
import { supabase } from "./supabase";
import { TaskList } from "./types";

export type Unsubscribe = () => void;
const TABLE = "personal_lists";

export async function loadLists(uid: string): Promise<TaskList[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(TABLE).select("data").eq("owner_uid", uid);
  if (error) return [];
  return (data ?? []).map((row) => row.data as TaskList);
}

export async function batchSaveLists(uid: string, lists: TaskList[]): Promise<void> {
  if (!supabase || lists.length === 0) return;
  const rows = lists.map((list) => ({
    id: list.id,
    owner_uid: uid,
    data: list,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from(TABLE).upsert(rows);
  if (error) console.error("[personalListSync] batchSaveLists error:", error);
}

export async function deleteList(uid: string, listId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from(TABLE).delete().eq("id", listId).eq("owner_uid", uid);
}

export async function subscribeLists(
  uid: string,
  onUpdate: (lists: TaskList[]) => void
): Promise<Unsubscribe> {
  if (!supabase) return () => {};
  const initial = await loadLists(uid);
  onUpdate(initial);
  const channel = supabase
    .channel(`personal_lists:${uid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `owner_uid=eq.${uid}` },
      async () => {
        const fresh = await loadLists(uid);
        onUpdate(fresh);
      }
    )
    .subscribe();
  return () => {
    if (supabase) supabase.removeChannel(channel);
  };
}