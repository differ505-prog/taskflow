/**
 * taskCommentsFS.ts — 任務評論雙軌存儲層
 *
 * 策略：
 * - Supabase (primary)：新建評論寫入 task_comments 表，多用戶共享
 * - Firebase (legacy)：繼續讀取舊有 users/{uid}/tasks/{taskId}/comments 的內容
 *
 * 兩邊數據各自獨立（新評論走 Supabase，舊評論走 Firebase）。
 * UI 層只看同一個 subscribeTaskComments，不再需要感知底層差異。
 */
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { getFirebaseDB } from "./firebase";
import { supabase, isSupabaseConfigured } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────
export interface TaskComment {
  id: string;
  content: string;
  authorUid: string;
  authorEmail: string;
  createdAt: string; // ISO
}

// ─── Supabase helpers ────────────────────────────────────────────────
function generateCommentId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function upsertSupabaseComment(args: {
  uid: string;
  taskId: string;
  authorEmail: string;
  content: string;
}): Promise<TaskComment> {
  const id = generateCommentId();
  const comment: TaskComment = {
    id,
    content: args.content.trim(),
    authorUid: args.uid,
    authorEmail: args.authorEmail,
    createdAt: new Date().toISOString(),
  };

  await supabase!.from("task_comments").insert({
    id,
    task_id: args.taskId,
    content: comment.content,
    author_uid: args.uid,
    author_email: args.authorEmail,
    created_at: comment.createdAt,
  });

  return comment;
}

async function deleteSupabaseComment(args: {
  uid: string;
  commentId: string;
}): Promise<void> {
  await supabase!
    .from("task_comments")
    .delete()
    .eq("id", args.commentId)
    .eq("author_uid", args.uid);
}

// ─── Firebase helpers (legacy) ──────────────────────────────────────
function firebaseCommentsPath(uid: string, taskId: string) {
  return `users/${uid}/tasks/${taskId}/comments`;
}

async function upsertFirebaseComment(args: {
  uid: string;
  taskId: string;
  authorEmail: string;
  content: string;
}): Promise<TaskComment> {
  const db = await getFirebaseDB();
  const id = generateCommentId();
  const ref = doc(db, firebaseCommentsPath(args.uid, args.taskId), id);
  const comment: TaskComment = {
    id,
    content: args.content.trim(),
    authorUid: args.uid,
    authorEmail: args.authorEmail,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, { ...comment });
  return comment;
}

async function deleteFirebaseComment(args: {
  uid: string;
  taskId: string;
  commentId: string;
}): Promise<void> {
  const db = await getFirebaseDB();
  const ref = doc(db, firebaseCommentsPath(args.uid, args.taskId), args.commentId);
  await deleteDoc(ref);
}

// ─── Dual-source subscribe ──────────────────────────────────────────
async function subscribeFirebaseComments(
  uid: string,
  taskId: string,
  onUpdate: (comments: TaskComment[]) => void
): Promise<() => void> {
  try {
    const db = await getFirebaseDB();
    const q = query(
      collection(db, firebaseCommentsPath(uid, taskId)),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: TaskComment[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            content: (data.content as string) ?? "",
            authorUid: (data.authorUid as string) ?? "",
            authorEmail: (data.authorEmail as string) ?? "",
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toDate().toISOString()
                : ((data.createdAt as string) ?? new Date().toISOString()),
          };
        });
        onUpdate(list);
      },
      (err) => {
        console.warn("[TaskComments][Firebase] snapshot error:", err);
        onUpdate([]);
      }
    );
  } catch (err) {
    console.warn("[TaskComments][Firebase] subscribe failed:", err);
    onUpdate([]);
    return () => {};
  }
}

// ─── Exported API ────────────────────────────────────────────────────

/**
 * 訂閱任務的所有評論
 * - Supabase 已配置：即時訂閱 task_comments 表（多使用者共享）
 * - Firebase：繼續監聽 legacy 路徑（舊有私人評論）
 * - 兩邊合併後按 createdAt 排序
 */
export async function subscribeTaskComments(
  uid: string,
  taskId: string,
  onUpdate: (comments: TaskComment[]) => void
): Promise<() => void> {
  let unsubFirebase: (() => void) | null = null;
  let fbComments: TaskComment[] = [];
  let fbReady = false;

  // Firebase legacy 訂閱（僅在 Supabase 未配置時開啟）
  // 若日後遷移完成，可移除此分支
  const fbPromise = isSupabaseConfigured()
    ? Promise.resolve()
    : subscribeFirebaseComments(uid, taskId, (list) => {
        fbComments = list;
        fbReady = true;
        onUpdate([...fbComments, ...sbComments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      });

  let sbComments: TaskComment[] = [];

  if (!isSupabaseConfigured()) {
    await fbPromise;
    return () => {
      const fn = unsubFirebase as (() => void) | null;
      if (typeof fn === "function") fn();
    };
  }

  // Supabase Realtime 訂閱
  const channel = supabase!
    .channel(`task_comments:${taskId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "task_comments",
        filter: `task_id=eq.${taskId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as Record<string, unknown>;
          const comment: TaskComment = {
            id: row.id as string,
            content: row.content as string,
            authorUid: row.author_uid as string,
            authorEmail: row.author_email as string,
            createdAt: row.created_at as string,
          };
          // 避免重複（Firebase 也許有同一條）
          setSbComments((prev) => {
            if (prev.find((c) => c.id === comment.id)) return prev;
            return [...prev, comment].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          });
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as Record<string, unknown>;
          setSbComments((prev) => prev.filter((c) => c.id !== row.id));
        }
      }
    )
    .subscribe();

  function setSbComments(fn: (prev: TaskComment[]) => TaskComment[]) {
    sbComments = fn(sbComments);
    const merged = [...fbComments, ...sbComments].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    onUpdate(merged);
  }

  // 初次載入
  try {
    const { data, error } = await supabase!
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      sbComments = (data as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        content: row.content as string,
        authorUid: row.author_uid as string,
        authorEmail: row.author_email as string,
        createdAt: row.created_at as string,
      }));
      onUpdate([...fbComments, ...sbComments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    }
  } catch (err) {
    console.warn("[TaskComments][Supabase] initial fetch failed:", err);
  }

  return () => {
    const fn = unsubFirebase as (() => void) | null;
    if (typeof fn === "function") fn();
    supabase!.removeChannel(channel);
  };
}

/**
 * 新增評論
 * - Supabase 已配置：寫入 task_comments 表
 * - 否則 fallback 到 Firebase
 */
export async function addTaskComment(args: {
  uid: string;
  taskId: string;
  authorEmail: string;
  content: string;
}): Promise<TaskComment> {
  if (isSupabaseConfigured()) {
    return upsertSupabaseComment(args);
  }
  return upsertFirebaseComment(args);
}

/**
 * 刪除評論（僅作者本人）
 * - Supabase 已配置：從 task_comments 表刪除
 * - 否則 fallback 到 Firebase
 */
export async function deleteTaskComment(args: {
  uid: string;
  taskId: string;
  commentId: string;
}): Promise<void> {
  if (isSupabaseConfigured()) {
    return deleteSupabaseComment({ uid: args.uid, commentId: args.commentId });
  }
  return deleteFirebaseComment(args);
}

/**
 * 一次性讀取所有評論（給匯出功能用）
 */
export async function getAllTaskComments(
  uid: string,
  taskId: string
): Promise<TaskComment[]> {
  const sb: TaskComment[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase!
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        (data as Record<string, unknown>[]).forEach((row) => {
          sb.push({
            id: row.id as string,
            content: row.content as string,
            authorUid: row.author_uid as string,
            authorEmail: row.author_email as string,
            createdAt: row.created_at as string,
          });
        });
      }
    } catch {
      // ignore
    }
  }

  const fb: TaskComment[] = [];
  try {
    const db = await getFirebaseDB();
    const q = query(
      collection(db, firebaseCommentsPath(uid, taskId)),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      fb.push({
        id: d.id,
        content: (data.content as string) ?? "",
        authorUid: (data.authorUid as string) ?? "",
        authorEmail: (data.authorEmail as string) ?? "",
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : ((data.createdAt as string) ?? new Date().toISOString()),
      });
    });
  } catch {
    // ignore
  }

  const all = [...sb, ...fb];
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
