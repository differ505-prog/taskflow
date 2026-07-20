/**
 * personalTaskSync.ts — 個人任務的 Supabase 同步層
 *
 * 取代 Firebase Firestore 的個人任務 collection，原因：
 * - 既有 Firebase security rules 依賴 Firebase Auth，但本專案用 Supabase Auth
 * - 兩套 Auth 沒有互通，導致 Firestore 寫入被規則擋下，跨設備同步完全失效
 *
 * 用法：
 *   subscribeTasks(uid, onUpdate) → Realtime 訂閱
 *   saveTask(uid, task)           → upsert 單筆
 *   batchSaveTasks(uid, tasks)    → upsert 整批
 *   deleteTask(uid, taskId)       → 刪除單筆
 *   loadTasks(uid)                → 一次性讀取
 */
import { supabase } from "./supabase";
import { Task } from "./types";

export type Unsubscribe = () => void;

const TABLE = "personal_tasks";

export async function loadTasks(uid: string): Promise<Task[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("owner_uid", uid);
  if (error) {
    console.error("[personalTaskSync] loadTasks error:", error);
    return [];
  }
  return (data ?? []).map((row) => row.data as Task);
}

export async function saveTask(uid: string, task: Task): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert({
    id: task.id,
    owner_uid: uid,
    data: task,
    is_archived: task.isArchived,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[personalTaskSync] saveTask error:", error);
}

export async function batchSaveTasks(uid: string, tasks: Task[]): Promise<void> {
  if (!supabase || tasks.length === 0) return;
  const rows = tasks.map((task) => ({
    id: task.id,
    owner_uid: uid,
    data: task,
    is_archived: task.isArchived,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from(TABLE).upsert(rows);
  if (error) console.error("[personalTaskSync] batchSaveTasks error:", error);
}

export async function deleteTask(uid: string, taskId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq("id", taskId).eq("owner_uid", uid);
  if (error) console.error("[personalTaskSync] deleteTask error:", error);
}

/**
 * 實時訂閱個人任務 — 任何設備寫入都會推送給所有訂閱者
 * deletedIdsRef: Set of task IDs being deleted. Handler reads .size each time (live ref).
 * 回傳清理函式
 *
 * 對 iOS Safari 的 WebSocket Suspend 問題：監聽 channel 狀態，斷線時自動重連
 */
export async function subscribeTasks(
  uid: string,
  onUpdate: (tasks: Task[], deletedId?: string) => void,
  deletedIdsRef?: Set<string>
): Promise<Unsubscribe> {
  if (!supabase) return () => {};

  // 動態過濾：每次 realtime callback 讀取最新的 .size，避免快照僵化
  const filterDeleted = (tasks: Task[]) =>
    deletedIdsRef && deletedIdsRef.size > 0
      ? tasks.filter((t) => !deletedIdsRef.has(t.id))
      : tasks;

  // Supabase Realtime 的 postgres_changes INSERT/UPDATE 廣播會隨機延遲（觀察到 22 秒~數分鐘），
  // 且呈現「下一個事件觸發才廣播出來」特性。光靠 5 秒一次性 timer 只保護訂閱後前幾秒，
  // 對「訂閱後 10 分鐘才新增任務」的場景無效。
  //
  // 雙層保護：
  // 1) 訂閱時 5 秒一次性 fallback — 保護剛啟動的視窗
  // 2) ongoing 10 秒靜默輪詢 — 監測 lastBroadcastAt，超過 30 秒沒收到任何 INSERT/UPDATE
  //    → 主動 loadTasks。DELETE 廣播即時，不算靜默也不更新 timestamp（不影響這層保護）。
  let fallbackFired = false;
  const fallbackTimer = setTimeout(async () => {
    if (fallbackFired) return;
    fallbackFired = true;
    try {
      const fresh = await loadTasks(uid);
      console.log(`[personalTaskSync] fallback poll fired（INSERT/UPDATE 廣播逾時 5s），任務數: ${fresh.length}`);
      onUpdate(filterDeleted(fresh));
    } catch (err) {
      console.error("[personalTaskSync] fallback poll failed:", err);
    }
  }, 5000);
  const cancelFallback = () => {
    clearTimeout(fallbackTimer);
    fallbackFired = true;
  };

  // 2) ongoing 10 秒靜默輪詢
  let lastBroadcastAt = Date.now();
  const SILENT_WINDOW_MS = 10_000;
  const periodicPollTimer = setInterval(async () => {
    if (Date.now() - lastBroadcastAt < SILENT_WINDOW_MS) return;
    try {
      const fresh = await loadTasks(uid);
      console.log(`[personalTaskSync] periodic poll fired（靜默 ${Math.floor((Date.now() - lastBroadcastAt) / 1000)}s），任務數: ${fresh.length}`);
      onUpdate(filterDeleted(fresh));
      lastBroadcastAt = Date.now(); // 重置視窗，避免持續觸發直到下次 INSERT/UPDATE
    } catch (err) {
      console.error("[personalTaskSync] periodic poll failed:", err);
    }
  }, SILENT_WINDOW_MS);
  const markBroadcast = () => {
    lastBroadcastAt = Date.now();
  };

  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;
  let subscribed = false;

  function buildChannel() {
    const channel = supabase!
      .channel(`personal_tasks:${uid}`);

    // 監聽 postgres 變更（INSERT/UPDATE/DELETE）
    // 注意：不使用 filter 參數，因為 Supabase Realtime 在 DELETE 時
    // 會先評估 filter（row 已消失），導致所有 DELETE 事件被吃掉。
    // 改在 callback 內做 client-side uid 過濾。
    // 拆分為三個獨立 handler：確認 DELETE 是否真的廣播出來
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE },
      async (payload) => {
        cancelFallback();
        markBroadcast();
        const tRecv = Date.now();
        console.log(`[personalTaskSync] INSERT callback received at ${new Date(tRecv).toISOString()} (deltaFromPayload=${tRecv - new Date(payload.commit_timestamp || Date.now()).getTime()}ms)`, payload);
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) return;
        const t0 = Date.now();
        try {
          const fresh = await loadTasks(uid);
          console.log(`[personalTaskSync] loadTasks 耗時 ${Date.now() - t0}ms，任務數: ${fresh.length}`);
          onUpdate(filterDeleted(fresh));
        } catch (err) {
          console.error("[personalTaskSync] loadTasks 失敗:", err);
        }
      }
    );

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: TABLE },
      async (payload) => {
        cancelFallback();
        markBroadcast();
        console.log(`[personalTaskSync] UPDATE callback`);
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) return;
        const t0 = Date.now();
        try {
          const fresh = await loadTasks(uid);
          console.log(`[personalTaskSync] loadTasks 耗時 ${Date.now() - t0}ms，任務數: ${fresh.length}`);
          onUpdate(filterDeleted(fresh));
        } catch (err) {
          console.error("[personalTaskSync] loadTasks 失敗:", err);
        }
      }
    );

    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: TABLE },
      async (payload) => {
        const raw = payload as { old?: { id?: string } };
        const deletedId = raw.old?.id;
        // 同步加入 deletedIdsRef：確保 filterDeleted 能看到
        if (deletedId && deletedIdsRef) deletedIdsRef.add(deletedId);
        console.log(`[personalTaskSync] DELETE callback, payload:`, JSON.stringify(payload));
        const t0 = Date.now();
        try {
          const fresh = await loadTasks(uid);
          console.log(`[personalTaskSync] loadTasks 耗時 ${Date.now() - t0}ms，任務數: ${fresh.length}`);
          // 直接把 deletedId 傳給 AppContext，讓 localOnly 邏輯也能排除
          onUpdate(filterDeleted(fresh), deletedId);
        } catch (err) {
          console.error("[personalTaskSync] loadTasks 失敗:", err);
        } finally {
          if (deletedId && deletedIdsRef) deletedIdsRef.delete(deletedId);
        }
      }
    );

    return channel;
  }

  // 初次載入
  const initial = await loadTasks(uid);
  onUpdate(filterDeleted(initial));

  // 建立 Realtime 訂閱：監聽自己 uid 的 INSERT/UPDATE/DELETE
  let activeChannel = buildChannel();
  // 訂閱（加 flag 防 React StrictMode / 熱更新觸發兩次 subscribe）
  if (!subscribed) {
    subscribed = true;
    activeChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        reconnectAttempts = 0;
        console.log("[personalTaskSync] Realtime channel 已連線");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`[personalTaskSync] channel ${status}`);
      }
    });
    console.log("[personalTaskSync] channel created");
  } else {
    console.warn("[personalTaskSync] channel 已訂閱，跳過重複 subscribe()");
  }

  return () => {
    clearTimeout(fallbackTimer);
    clearInterval(periodicPollTimer);
    if (activeChannel) supabase!.removeChannel(activeChannel);
    activeChannel = null as unknown as ReturnType<typeof buildChannel>;
  };
}