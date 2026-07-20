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

    channel.on("system", {} as Parameters<typeof channel.on>[0], (payload) => {
      if (payload.status === "connected") {
        reconnectAttempts = 0;
      } else if (
        payload.status === "disconnected" ||
        payload.status === "timeout" ||
        payload.status === "channel_error"
      ) {
        console.warn(`[personalListSync] Realtime channel ${payload.status}`);
        if (reconnectAttempts < MAX_RECONNECT) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
          reconnectAttempts++;
          console.log(`[personalListSync] ${delay / 1000}s 後重連 (${reconnectAttempts}/${MAX_RECONNECT})`);
          setTimeout(() => {
            const newChannel = buildChannel();
            activeChannel = newChannel;
            void newChannel.subscribe();
          }, delay);
        }
      }
    });

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `owner_uid=eq.${uid}` },
      async () => {
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
    await activeChannel.subscribe();
  } else {
    console.warn("[personalListSync] channel 已訂閱，跳過重複 subscribe()");
  }

  return () => {
    if (activeChannel) supabase!.removeChannel(activeChannel);
    activeChannel = null as unknown as ReturnType<typeof buildChannel>;
  };
}