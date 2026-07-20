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

/**
 * 對 iOS Safari WebSocket Suspend：監聽 channel 狀態，斷線時自動重連
 */
export async function subscribeLists(
  uid: string,
  onUpdate: (lists: TaskList[]) => void
): Promise<Unsubscribe> {
  if (!supabase) return () => {};

  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;
  let subscribed = false;

  function buildChannel() {
    const channel = supabase!
      .channel(`personal_lists:${uid}`);

    // 拆分為三個獨立 handler（原因見 personalTaskSync.ts 註解）
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE },
      async (payload) => {
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) return;
        const fresh = await loadLists(uid);
        onUpdate(fresh);
      }
    );

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: TABLE },
      async (payload) => {
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) return;
        const fresh = await loadLists(uid);
        onUpdate(fresh);
      }
    );

    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: TABLE },
      async (payload) => {
        console.log(`[personalListSync] DELETE callback, payload:`, JSON.stringify(payload));
        // DELETE 時 old 只有 id，無 owner_uid，channel 名稱已綁定 uid。
        const fresh = await loadLists(uid);
        onUpdate(fresh);
      }
    );

    return channel;
  }

  const initial = await loadLists(uid);
  onUpdate(initial);

  let activeChannel = buildChannel();
  // 訂閱（加 flag 防 React StrictMode / 熱更新觸發兩次 subscribe）
  if (!subscribed) {
    subscribed = true;
    activeChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        reconnectAttempts = 0;
        console.log("[personalListSync] Realtime channel 已連線");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`[personalListSync] channel ${status}`);
      }
    });
    console.log("[personalListSync] channel created");
  } else {
    console.warn("[personalListSync] channel 已訂閱，跳過重複 subscribe()");
  }

  return () => {
    if (activeChannel) supabase!.removeChannel(activeChannel);
    activeChannel = null as unknown as ReturnType<typeof buildChannel>;
  };
}