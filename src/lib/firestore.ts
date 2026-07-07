/**
 * Firestore 資料操作層
 * 所有 Firestore 讀寫都經過這裡
 *
 * Shared List 自 2026-07 起改用 Supabase Realtime + Postgres。
 * 為保留 AppContext 的 import 介面相容，本檔案 export 舊簽名函式，
 * 內部實作委派給 src/lib/sharedSync.ts。
 *
 * Firebase 仍用於：個人任務/清單/習慣/標籤/番茄鐘的本地同步儲存。
 */
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDB } from "./firebase";
import { Task, TaskList, Habit, PomodoroSession, Tag, SharedListMeta, SharedListSnapshot } from "./types";
import * as SharedSync from "./sharedSync";
import { isSupabaseConfigured } from "./supabase";

// ─── 路徑常數 ────────────────────────────────────────────────
const uid = (userId: string) => userId;
const tasksCol    = (userId: string) => `users/${uid(userId)}/tasks`;
const listsCol    = (userId: string) => `users/${uid(userId)}/lists`;
const habitsCol   = (userId: string) => `users/${uid(userId)}/habits`;
const pomodoroCol = (userId: string) => `users/${uid(userId)}/pomodoro`;
const tagsCol     = (userId: string) => `users/${uid(userId)}/tags`;

// ─── 個人資料：任務 ─────────────────────────────────────────
export async function subscribeTasks(
  userId: string,
  onUpdate: (tasks: Task[]) => void
): Promise<Unsubscribe> {
  const db = await getFirebaseDB();
  const q = query(collection(db, tasksCol(userId)), orderBy("order"));
  return onSnapshot(q, (snap) => {
    const tasks: Task[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Task));
    onUpdate(tasks);
  });
}

export async function saveTask(userId: string, task: Task): Promise<void> {
  const db = await getFirebaseDB();
  await setDoc(doc(db, tasksCol(userId), task.id), {
    ...task,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const db = await getFirebaseDB();
  await deleteDoc(doc(db, tasksCol(userId), taskId));
}

export async function batchSaveTasks(userId: string, tasks: Task[]): Promise<void> {
  const db = await getFirebaseDB();
  const batch = writeBatch(db);
  const now = Timestamp.now().toDate().toISOString();
  for (const task of tasks) {
    batch.set(doc(db, tasksCol(userId), task.id), { ...task, updatedAt: now });
  }
  await batch.commit();
}

// ─── 個人資料：清單 ─────────────────────────────────────────
export async function subscribeLists(
  userId: string,
  onUpdate: (lists: TaskList[]) => void
): Promise<Unsubscribe> {
  const db = await getFirebaseDB();
  const q = query(collection(db, listsCol(userId)), orderBy("createdAt"));
  return onSnapshot(q, (snap) => {
    const lists: TaskList[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TaskList));
    onUpdate(lists);
  });
}

export async function saveList(userId: string, list: TaskList): Promise<void> {
  const db = await getFirebaseDB();
  await setDoc(doc(db, listsCol(userId), list.id), {
    ...list,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
}

export async function deleteList(userId: string, listId: string): Promise<void> {
  const db = await getFirebaseDB();
  await deleteDoc(doc(db, listsCol(userId), listId));
}

// ─── 個人資料：習慣 ─────────────────────────────────────────
export async function subscribeHabits(
  userId: string,
  onUpdate: (habits: Habit[]) => void
): Promise<Unsubscribe> {
  const db = await getFirebaseDB();
  const q = query(collection(db, habitsCol(userId)), orderBy("createdAt"));
  return onSnapshot(q, (snap) => {
    const habits: Habit[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Habit));
    onUpdate(habits);
  });
}

export async function saveHabit(userId: string, habit: Habit): Promise<void> {
  const db = await getFirebaseDB();
  await setDoc(doc(db, habitsCol(userId), habit.id), habit);
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const db = await getFirebaseDB();
  await deleteDoc(doc(db, habitsCol(userId), habitId));
}

// ─── 個人資料：番茄鐘 ───────────────────────────────────────
export async function subscribePomodoro(
  userId: string,
  onUpdate: (sessions: PomodoroSession[]) => void
): Promise<Unsubscribe> {
  const db = await getFirebaseDB();
  const q = query(collection(db, pomodoroCol(userId)), orderBy("startTime", "desc"));
  return onSnapshot(q, (snap) => {
    const sessions: PomodoroSession[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as PomodoroSession));
    onUpdate(sessions);
  });
}

export async function savePomodoroSession(
  userId: string,
  session: PomodoroSession
): Promise<void> {
  const db = await getFirebaseDB();
  await setDoc(doc(db, pomodoroCol(userId), session.id), session);
}

// ─── 個人資料：標籤 ─────────────────────────────────────────
export async function subscribeTags(
  userId: string,
  onUpdate: (tags: Tag[]) => void
): Promise<Unsubscribe> {
  const db = await getFirebaseDB();
  const q = query(collection(db, tagsCol(userId)));
  return onSnapshot(q, (snap) => {
    const tags: Tag[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Tag));
    onUpdate(tags);
  });
}

export async function saveTag(userId: string, tag: Tag): Promise<void> {
  const db = await getFirebaseDB();
  await setDoc(doc(db, tagsCol(userId), tag.id), tag);
}

// ─── 一次性寫入預設清單（首次登入用）────────────────────────
export async function seedDefaultLists(
  userId: string,
  defaults: Omit<TaskList, "id" | "createdAt" | "updatedAt">[]
): Promise<void> {
  const db = await getFirebaseDB();
  const batch = writeBatch(db);
  const now = Timestamp.now().toDate().toISOString();
  for (const list of defaults) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    batch.set(doc(db, listsCol(userId), id), { ...list, id, createdAt: now, updatedAt: now });
  }
  await batch.commit();
}

// ─── 全量匯入（從 JSON）─────────────────────────────────────
export async function importAllData(
  userId: string,
  data: {
    tasks?: Task[];
    lists?: TaskList[];
    habits?: Habit[];
    pomodoro?: PomodoroSession[];
    tags?: Tag[];
  }
): Promise<{ tasks: number; habits: number; lists: number }> {
  const db = await getFirebaseDB();
  const batch = writeBatch(db);
  const now = Timestamp.now().toDate().toISOString();
  let taskCount = 0, habitCount = 0, listCount = 0;

  if (data.lists?.length) {
    for (const list of data.lists) {
      batch.set(doc(db, listsCol(userId), list.id), { ...list, updatedAt: now });
      listCount++;
    }
  }
  if (data.tasks?.length) {
    for (const task of data.tasks) {
      batch.set(doc(db, tasksCol(userId), task.id), { ...task, updatedAt: now });
      taskCount++;
    }
  }
  if (data.habits?.length) {
    for (const habit of data.habits) {
      batch.set(doc(db, habitsCol(userId), habit.id), { ...habit, updatedAt: now });
      habitCount++;
    }
  }

  await batch.commit();
  return { tasks: taskCount, habits: habitCount, lists: listCount };
}

// ─── Shared List — 全部委派給 SharedSync ───────────────────────────
// 保留舊 export signature 以相容 AppContext。

function normalizeSnapshot(snap: NonNullable<Awaited<ReturnType<typeof SharedSync.fetchSharedSnapshot>>>): SharedListSnapshot {
  return {
    list: { ...snap.list, sharedId: snap.list.id, ownerId: snap.list.ownerId ?? "" },
    tasks: snap.tasks,
    ownerId: snap.list.ownerId ?? "",
    ownerName: snap.ownerName,
    updatedAt: new Date().toISOString(),
  };
}

export async function createSharedList(
  list: TaskList,
  tasks: Task[],
  ownerId: string,
  ownerName?: string,
  ownerEmail?: string | null
): Promise<string> {
  const sharedListId = `sl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  await SharedSync.ensureSharedList({
    sharedListId,
    ownerUid: ownerId,
    ownerEmail: ownerEmail ?? null,
    ownerName: ownerName || "",
    list: { ...list, sharedId: sharedListId, ownerId },
  });

  // 一次寫入第一批任務（每個都會拿到獨立 row + position）
  if (tasks.length > 0) {
    await SharedSync.upsertSharedTasks(sharedListId, tasks);
  }

  return sharedListId;
}

export async function updateSharedSnapshot(
  sharedListId: string,
  list: TaskList,
  tasks: Task[],
  _ownerId: string,
  _ownerName?: string,
  onWriteComplete?: (sharedListId: string, tasks: Task[]) => void
): Promise<void> {
  // 1) 更新 list 自身 (僅更新會變動的欄位，避免無謂觸發)
  const { data: listRow } = await (await import("./supabase")).supabase!
    .from("shared_lists")
    .select("name,icon,color")
    .eq("id", sharedListId)
    .maybeSingle();

  if (
    !listRow ||
    listRow.name !== list.name ||
    listRow.icon !== list.icon ||
    listRow.color !== list.color
  ) {
    await SharedSync.ensureSharedList({
      sharedListId,
      ownerUid: list.ownerId || _ownerId,
      ownerEmail: null,
      ownerName: _ownerName || "",
      list,
    });
  }

  // 2) 用 Server-side diff：先抓 server rows，比對 id -> 在, 不在 -> 刪除
  const { data: existingRows } = await (await import("./supabase")).supabase!
    .from("shared_tasks")
    .select("id")
    .eq("shared_list_id", sharedListId);

  const existingIds = new Set((existingRows || []).map((r: any) => r.id));
  const incomingIds = new Set(tasks.map((t) => t.id));

  const toUpsert = tasks.filter((t) => t.id && !existingIds.has(t.id) || existingIds.has(t.id));
  const toDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id));

  if (toUpsert.length > 0) {
    await SharedSync.upsertSharedTasks(sharedListId, toUpsert);
  }
  await Promise.all(
    toDelete.map((id) => SharedSync.deleteSharedTask(sharedListId, id))
  );

  if (onWriteComplete) {
    try {
      onWriteComplete(sharedListId, tasks);
    } catch (cbError) {
      // eslint-disable-next-line no-console
      console.error("[SharedSync] onWriteComplete threw:", cbError);
    }
  }
}

export async function getSharedSnapshot(sharedListId: string): Promise<SharedListSnapshot | null> {
  const snap = await SharedSync.fetchSharedSnapshot(sharedListId);
  if (!snap) return null;
  return normalizeSnapshot(snap);
}

export async function subscribeToSharedSnapshot(
  sharedListId: string,
  onUpdate: (snapshot: SharedListSnapshot | null) => void,
  onDeleted?: () => void
): Promise<Unsubscribe> {
  if (!isSupabaseConfigured()) {
    // eslint-disable-next-line no-console
    console.warn("[SharedSync] Supabase not configured; realtime disabled");
    onUpdate(null);
    return Promise.resolve(() => {});
  }

  const unsub = SharedSync.subscribeToSharedList(sharedListId, (snap) => {
    if (!snap) {
      onDeleted?.();
      onUpdate(null);
      return;
    }
    onUpdate(normalizeSnapshot(snap));
  });

  return Promise.resolve(() => unsub());
}

export async function deleteSharedList(sharedListId: string): Promise<void> {
  // 透過 cascade 自然刪掉 tasks / members；只要刪 shared_lists row
  const { supabase } = await import("./supabase");
  if (supabase) {
    await supabase.from("shared_lists").delete().eq("id", sharedListId);
  }
}

export async function getSharedListMeta(sharedListId: string): Promise<SharedListMeta | null> {
  const snap = await SharedSync.fetchSharedSnapshot(sharedListId);
  if (!snap) return null;
  return {
    id: sharedListId,
    ownerId: snap.list.ownerId ?? "",
    listId: snap.list.id,
    ownerName: snap.ownerName,
    createdAt: snap.list.createdAt ?? new Date().toISOString(),
  };
}

// 成員管理 API（轉接給 SharedSync）
export async function inviteToSharedList(
  sharedListId: string,
  memberEmail: string,
  role: "editor" | "viewer" = "editor"
): Promise<void> {
  await SharedSync.inviteMember({ sharedListId, memberEmail, role });
}

export async function kickFromSharedList(
  sharedListId: string,
  memberEmail: string
): Promise<void> {
  await SharedSync.removeMember({ sharedListId, memberEmail });
}

export async function bindCurrentUserToSharedList(args: {
  sharedListId: string;
  memberUid: string;
  memberEmail: string;
}): Promise<void> {
  // 走 RPC：後端比對 email 後才寫入 — 補釘 #3
  await SharedSync.acceptInvite({
    sharedListId: args.sharedListId,
    callerUid: args.memberUid,
    callerEmail: args.memberEmail,
  });
}

export async function getMyRoleInSharedList(
  sharedListId: string,
  callerUid: string
): Promise<"owner" | "editor" | "viewer" | null> {
  return SharedSync.getMyRole({ sharedListId, callerUid });
}

export async function listSharedMembers(sharedListId: string) {
  return SharedSync.listMembers(sharedListId);
}

export async function setSharedTaskPosition(
  sharedListId: string,
  taskId: string,
  position: number
): Promise<void> {
  await SharedSync.setSharedTaskPosition(sharedListId, taskId, position);
}
