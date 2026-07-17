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
    console.warn("[personalTaskSync] loadTasks error:", error);
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
  if (error) console.warn("[personalTaskSync] saveTask error:", error);
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
  if (error) console.warn("[personalTaskSync] batchSaveTasks error:", error);
}

export async function deleteTask(uid: string, taskId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq("id", taskId).eq("owner_uid", uid);
  if (error) console.warn("[personalTaskSync] deleteTask error:", error);
}

/**
 * 實時訂閱個人任務 — 任何設備寫入都會推送給所有訂閱者
 * deletedIdsRef: Set of task IDs being deleted. Handler reads .size each time (live ref).
 * 回傳清理函式
 */
export async function subscribeTasks(
  uid: string,
  onUpdate: (tasks: Task[]) => void,
  deletedIdsRef?: Set<string>
): Promise<Unsubscribe> {
  if (!supabase) return () => {};

  // 動態過濾：每次 realtime callback 讀取最新的 .size，避免快照僵化
  const filterDeleted = (tasks: Task[]) =>
    deletedIdsRef && deletedIdsRef.size > 0
      ? tasks.filter((t) => !deletedIdsRef.has(t.id))
      : tasks;

  // 初次載入
  const initial = await loadTasks(uid);
  onUpdate(filterDeleted(initial));

  // Realtime 訂閱：監聽自己 uid 的 INSERT/UPDATE/DELETE
  const channel = supabase
    .channel(`personal_tasks:${uid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `owner_uid=eq.${uid}` },
      async () => {
        const fresh = await loadTasks(uid);
        onUpdate(filterDeleted(fresh));
      }
    )
    .subscribe();

  return () => {
    if (supabase) supabase.removeChannel(channel);
  };
}