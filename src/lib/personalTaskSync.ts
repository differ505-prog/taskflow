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
  onUpdate: (tasks: Task[], deletedId?: string, pendingDeletions?: string[]) => void,
  deletedIdsRef?: Set<string>
): Promise<Unsubscribe> {
  if (!supabase) return () => {};

  // 動態過濾：每次 realtime callback 讀取最新的 .size，避免快照僵化
  // extraDeleted 參數用於 INSERT/UPDATE callback 傳入 pendingDeletions 快照
  const filterDeleted = (tasks: Task[], extraDeleted?: string[]) => {
    if (!deletedIdsRef && !extraDeleted?.length) return tasks;
    const allDeleted = new Set(deletedIdsRef ?? []);
    extraDeleted?.forEach((id) => allDeleted.add(id));
    return tasks.filter((t) => !allDeleted.has(t.id));
  };

  // Supabase Realtime 的 postgres_changes INSERT/UPDATE 廣播會隨機延遲（觀察到 22 秒~數分鐘），
  // 且呈現「下一個事件觸發才廣播出來」特性。光靠 5 秒一次性 timer 只保護訂閱後前幾秒，
  // 對「訂閱後 10 分鐘才新增任務」的場景無效。
  //
  // 雙層保護：
  // 1) 訂閱時 5 秒一次性 fallback — 保護剛啟動的視窗
  // 2) ongoing 3 秒靜默輪詢 — 監測 lastBroadcastAt，超過 3 秒沒收到任何 INSERT/UPDATE
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

  // 2) ongoing 靜默輪詢：當 realtime INSERT/UPDATE 廣播逾時時的 fallback
  // 3 秒間隔 — realtime 在大多數情況下應該 < 1s 內送達，3 秒是最保險且幾乎無感的 fallback
  let lastBroadcastAt = Date.now();
  const POLL_INTERVAL_MS = 3_000;
  const SILENT_WINDOW_MS = POLL_INTERVAL_MS;
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
  }, POLL_INTERVAL_MS);
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
        // 標記 [REALTIME-RECEIVED]：這是從 realtime channel 收到的 INSERT callback
        // 如果 log 裡完全沒看到這行 → realtime 廣播根本沒送到這個 client
        console.log(`[personalTaskSync] [REALTIME-RECEIVED] INSERT callback at ${new Date(tRecv).toISOString()}`, payload);
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) {
          console.log(`[personalTaskSync] INSERT callback owner_uid 不符 (${raw.new.owner_uid} !== ${uid})，跳過`);
          return;
        }
        const t0 = Date.now();
        try {
          const fresh = await loadTasks(uid);
          console.log(`[personalTaskSync] loadTasks 耗時 ${Date.now() - t0}ms，任務數: ${fresh.length}`);
          // 傳入此刻 deletedIdsRef 快照，讓 merge 的刪除集合包含所有進行中的刪除
          const pendingDeletions = deletedIdsRef && deletedIdsRef.size > 0 ? Array.from(deletedIdsRef) : [];
          onUpdate(filterDeleted(fresh, pendingDeletions), undefined, pendingDeletions);
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
        // 標記 [REALTIME-RECEIVED]：這是從 realtime channel 收到的 UPDATE callback
        console.log(`[personalTaskSync] [REALTIME-RECEIVED] UPDATE callback`, payload);
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) {
          console.log(`[personalTaskSync] UPDATE callback owner_uid 不符，跳過`);
          return;
        }
        const t0 = Date.now();
        try {
          const fresh = await loadTasks(uid);
          console.log(`[personalTaskSync] loadTasks 耗時 ${Date.now() - t0}ms，任務數: ${fresh.length}`);
          // 傳入此刻 deletedIdsRef 快照，讓 merge 的刪除集合包含所有進行中的刪除
          const pendingDeletions = deletedIdsRef && deletedIdsRef.size > 0 ? Array.from(deletedIdsRef) : [];
          onUpdate(filterDeleted(fresh, pendingDeletions), undefined, pendingDeletions);
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
      // 把所有 status 都 log，幫助診斷「到底有沒有訂閱成功」
      console.log(`[personalTaskSync] subscribe status: ${status}`);
      if (status === "SUBSCRIBED") {
        reconnectAttempts = 0;
        console.log(`[personalTaskSync] Realtime channel 已連線，主題=personal_tasks:${uid}`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`[personalTaskSync] channel ${status}`);
      }
    });
    console.log("[personalTaskSync] channel created");
  } else {
    console.warn("[personalTaskSync] channel 已訂閱，跳過重複 subscribe()");
  }

  // ─────────────────────────────────────────────────────────────────
  // PWA / iOS Safari 喚醒同步：背景 → 前景時主動 loadTasks
  //
  // 問題：iOS PWA 在背景時 WebSocket / JS 會被 iOS 凍結，realtime 廣播丟失。
  // 解法：監聽三個事件，從背景切回前景時（或 PWA cold start / 網路恢復），
  //       主動 loadTasks 一次，確保使用者看到最新資料。
  // ─────────────────────────────────────────────────────────────────
  const refreshOnAwake = async (reason: string) => {
    // 避免重複觸發：如果上一次 refresh 還在跑，不重疊
    if (document.visibilityState !== "visible") return;
    try {
      const t0 = Date.now();
      const fresh = await loadTasks(uid);
      console.log(`[personalTaskSync] [AWAKE-REFRESH] ${reason}，loadTasks 耗時 ${Date.now() - t0}ms，任務數: ${fresh.length}`);
      onUpdate(filterDeleted(fresh));
      markBroadcast(); // 重置 lastBroadcastAt，避免 periodic poll 立刻又跑
    } catch (err) {
      console.error(`[personalTaskSync] [AWAKE-REFRESH] ${reason} 失敗:`, err);
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      console.log("[personalTaskSync] [AWAKE] visibilitychange → visible，觸發 refresh");
      refreshOnAwake("visibilitychange");
    }
  };
  const onPageShow = (e: PageTransitionEvent) => {
    // e.persisted === true 代表是從 bfcache 恢復（PWA 切走又切回的典型場景）
    console.log(`[personalTaskSync] [AWAKE] pageshow persisted=${e.persisted}，觸發 refresh`);
    refreshOnAwake(e.persisted ? "pageshow(bfcache)" : "pageshow");
  };
  const onOnline = () => {
    console.log("[personalTaskSync] [AWAKE] online 事件，觸發 refresh");
    refreshOnAwake("online(網路恢復)");
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("online", onOnline);
  console.log("[personalTaskSync] PWA 喚醒監聽器已掛載 (visibilitychange + pageshow + online)");

  return () => {
    clearTimeout(fallbackTimer);
    clearInterval(periodicPollTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("online", onOnline);
    if (activeChannel) supabase!.removeChannel(activeChannel);
    activeChannel = null as unknown as ReturnType<typeof buildChannel>;
  };
}