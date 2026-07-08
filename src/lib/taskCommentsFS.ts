/**
 * 任務評論 (Task Comments)
 *
 * Schema: tasks/{taskId}/comments/{commentId}
 *   - id
 *   - content  (純文字)
 *   - authorUid
 *   - authorEmail
 *   - createdAt (ISO string)
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

export interface TaskComment {
  id: string;
  content: string;
  authorUid: string;
  authorEmail: string;
  createdAt: string; // ISO
}

function commentsCol(uid: string, taskId: string) {
  return `users/${uid}/tasks/${taskId}/comments`;
}

/**
 * 訂閱任務的所有評論（依時間排序）
 */
export async function subscribeTaskComments(
  uid: string,
  taskId: string,
  onUpdate: (comments: TaskComment[]) => void
): Promise<() => void> {
  try {
    const db = await getFirebaseDB();
    const q = query(collection(db, commentsCol(uid, taskId)), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        const list: TaskComment[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            content: data.content ?? "",
            authorUid: data.authorUid ?? "",
            authorEmail: data.authorEmail ?? "",
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toDate().toISOString()
                : data.createdAt ?? new Date().toISOString(),
          };
        });
        onUpdate(list);
      },
      (err) => {
        console.warn("[TaskComments] snapshot error:", err);
        onUpdate([]);
      }
    );
  } catch (err) {
    console.warn("[TaskComments] subscribe failed:", err);
    onUpdate([]);
    return () => {};
  }
}

function generateCommentId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 新增評論
 */
export async function addTaskComment(args: {
  uid: string;
  taskId: string;
  authorEmail: string;
  content: string;
}): Promise<TaskComment> {
  const db = await getFirebaseDB();
  const id = generateCommentId();
  const ref = doc(db, commentsCol(args.uid, args.taskId), id);
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

/**
 * 刪除評論（僅作者本人）
 */
export async function deleteTaskComment(args: {
  uid: string;
  taskId: string;
  commentId: string;
}): Promise<void> {
  const db = await getFirebaseDB();
  const ref = doc(db, commentsCol(args.uid, args.taskId), args.commentId);
  await deleteDoc(ref);
}

/**
 * 一次性讀取所有評論（給匯出功能用）
 */
export async function getAllTaskComments(
  uid: string,
  taskId: string
): Promise<TaskComment[]> {
  try {
    const db = await getFirebaseDB();
    const q = query(collection(db, commentsCol(uid, taskId)), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        content: data.content ?? "",
        authorUid: data.authorUid ?? "",
        authorEmail: data.authorEmail ?? "",
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt ?? new Date().toISOString(),
      } as TaskComment;
    });
  } catch {
    return [];
  }
}