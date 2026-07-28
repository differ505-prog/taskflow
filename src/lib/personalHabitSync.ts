/**
 * personalHabitSync.ts — 個人習慣的 Supabase 同步層
 *
 * 對齊 personalTaskSync.ts：同樣的 JSONB + realtime pattern,
 * 但 habits 沒有 DELETE 需求（archive/unarchive 用 UPDATE is_archived 處理,§P0-2）。
 *
 * 用法：
 *   subscribeHabits(uid, onUpdate) → Realtime 訂閱
 *   saveHabit(uid, habit)          → upsert 單筆
 *   batchSaveHabits(uid, habits)  → upsert 整批
 *   loadHabits(uid)               → 一次性讀取
 */
import { supabase } from "./supabase";
import { Habit } from "./types";

export type Unsubscribe = () => void;

const TABLE = "personal_habits";

export async function loadHabits(uid: string): Promise<Habit[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("owner_uid", uid);
  if (error) {
    console.error("[personalHabitSync] loadHabits error:", error);
    return [];
  }
  return (data ?? []).map((row) => row.data as Habit);
}

export async function saveHabit(uid: string, habit: Habit): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert({
    id: habit.id,
    owner_uid: uid,
    data: habit,
    is_archived: !!habit.archivedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[personalHabitSync] saveHabit error:", error);
}

export async function batchSaveHabits(uid: string, habits: Habit[]): Promise<void> {
  if (!supabase || habits.length === 0) return;
  const rows = habits.map((habit) => ({
    id: habit.id,
    owner_uid: uid,
    data: habit,
    is_archived: !!habit.archivedAt,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from(TABLE).upsert(rows);
  if (error) console.error("[personalHabitSync] batchSaveHabits error:", error);
}

/**
 * 實時訂閱個人習慣 — 任一裝置寫入都會推送給所有訂閱者
 *
 * 對齊 subscribeTasks 的雙層防護（§26-A）：
 * 1) 訂閱時 5 秒 fallback timer — 保護剛啟動的視窗
 * 2) ongoing 3 秒靜默輪詢 — Supabase Realtime postgres_changes
 *    INSERT/UPDATE 廣播隨機延遲(觀察 22 秒~數分鐘),超時主動 loadHabits
 *
 * 對 iOS Safari WebSocket Suspend：監聽 channel 狀態自動重連
 * 對 iOS PWA 背景凍結：visibilitychange / pageshow / online 觸發 refresh
 */
export async function subscribeHabits(
  uid: string,
  onUpdate: (habits: Habit[]) => void
): Promise<Unsubscribe> {
  if (!supabase) return () => {};

  let fallbackFired = false;
  const fallbackTimer = setTimeout(async () => {
    if (fallbackFired) return;
    fallbackFired = true;
    try {
      const fresh = await loadHabits(uid);
      console.log(`[personalHabitSync] fallback poll fired（INSERT/UPDATE 廣播逾時 5s），habit 數: ${fresh.length}`);
      onUpdate(fresh);
    } catch (err) {
      console.error("[personalHabitSync] fallback poll failed:", err);
    }
  }, 5000);
  const cancelFallback = () => {
    clearTimeout(fallbackTimer);
    fallbackFired = true;
  };

  let lastBroadcastAt = Date.now();
  const POLL_INTERVAL_MS = 3_000;
  const SILENT_WINDOW_MS = POLL_INTERVAL_MS;
  const periodicPollTimer = setInterval(async () => {
    if (Date.now() - lastBroadcastAt < SILENT_WINDOW_MS) return;
    try {
      const fresh = await loadHabits(uid);
      console.log(`[personalHabitSync] periodic poll fired（靜默 ${Math.floor((Date.now() - lastBroadcastAt) / 1000)}s），habit 數: ${fresh.length}`);
      onUpdate(fresh);
      lastBroadcastAt = Date.now();
    } catch (err) {
      console.error("[personalHabitSync] periodic poll failed:", err);
    }
  }, POLL_INTERVAL_MS);
  const markBroadcast = () => {
    lastBroadcastAt = Date.now();
  };

  function buildChannel() {
    const channel = supabase!.channel(`personal_habits:${uid}`);

    // INSERT / UPDATE 統一由 loadHabits 取代廣播本身,因為 habit 是整個 JSONB,
    // realtime 廣播只給新 row,但我們要的是「整份 habits 陣列」,所以 fetch 全量最簡單
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE },
      async (payload) => {
        cancelFallback();
        markBroadcast();
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) {
          console.log(`[personalHabitSync] INSERT owner_uid 不符，跳過`);
          return;
        }
        try {
          const fresh = await loadHabits(uid);
          onUpdate(fresh);
        } catch (err) {
          console.error("[personalHabitSync] loadHabits 失敗:", err);
        }
      }
    );

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: TABLE },
      async (payload) => {
        cancelFallback();
        markBroadcast();
        const raw = payload as { new?: { owner_uid?: string } };
        if (raw.new && raw.new.owner_uid !== uid) {
          console.log(`[personalHabitSync] UPDATE owner_uid 不符，跳過`);
          return;
        }
        try {
          const fresh = await loadHabits(uid);
          onUpdate(fresh);
        } catch (err) {
          console.error("[personalHabitSync] loadHabits 失敗:", err);
        }
      }
    );

    return channel;
  }

  // 初次載入
  const initial = await loadHabits(uid);
  onUpdate(initial);

  let activeChannel = buildChannel();
  activeChannel.subscribe((status) => {
    console.log(`[personalHabitSync] subscribe status: ${status}`);
    if (status === "SUBSCRIBED") {
      console.log(`[personalHabitSync] Realtime channel 已連線，主題=personal_habits:${uid}`);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      console.warn(`[personalHabitSync] channel ${status}`);
    }
  });
  console.log("[personalHabitSync] channel created");

  // ── PWA / iOS Safari 喚醒同步：背景 → 前景時主動 loadHabits
  const refreshOnAwake = async (reason: string) => {
    if (document.visibilityState !== "visible") return;
    try {
      const fresh = await loadHabits(uid);
      console.log(`[personalHabitSync] [AWAKE-REFRESH] ${reason}，habit 數: ${fresh.length}`);
      onUpdate(fresh);
      markBroadcast();
    } catch (err) {
      console.error(`[personalHabitSync] [AWAKE-REFRESH] ${reason} 失敗:`, err);
    }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") refreshOnAwake("visibilitychange");
  };
  const onPageShow = (e: PageTransitionEvent) => {
    refreshOnAwake(e.persisted ? "pageshow(bfcache)" : "pageshow");
  };
  const onOnline = () => refreshOnAwake("online(網路恢復)");

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("online", onOnline);

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