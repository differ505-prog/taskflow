/**
 * Firestore 資料操作層
 * 所有 Firestore 讀寫都經過這裡
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

// ─── 路徑常數 ────────────────────────────────────────────────
const uid = (userId: string) => userId;
const tasksCol = (userId: string) => `users/${uid(userId)}/tasks`;
const listsCol = (userId: string) => `users/${uid(userId)}/lists`;
const habitsCol = (userId: string) => `users/${uid(userId)}/habits`;
const pomodoroCol = (userId: string) => `users/${uid(userId)}/pomodoro`;
const tagsCol = (userId: string) => `users/${uid(userId)}/tags`;

// ─── 通用 helpers ────────────────────────────────────────────
function docId(taskId: string) {
  return taskId; // use the id as the Firestore document id
}

// ─── 任務 ────────────────────────────────────────────────────
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

// ─── 清單 ────────────────────────────────────────────────────
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

// ─── 習慣 ────────────────────────────────────────────────────
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
  await setDoc(doc(db, habitsCol(userId), habit.id), {
    ...habit,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const db = await getFirebaseDB();
  await deleteDoc(doc(db, habitsCol(userId), habitId));
}

// ─── 番茄鐘 ─────────────────────────────────────────────────
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

// ─── 標籤 ────────────────────────────────────────────────────
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

// ─── 一次寫入所有預設清單（首次登入用）──────────────────────
export async function seedDefaultLists(userId: string, defaults: Omit<TaskList, "id" | "createdAt" | "updatedAt">[]): Promise<void> {
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

// ─── Shared List Operations ─────────────────────────────────────
export async function createSharedList(
  list: TaskList,
  tasks: Task[],
  ownerId: string,
  ownerName?: string
): Promise<string> {
  const db = await getFirebaseDB();
  const sharedListId = `sl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Timestamp.now().toDate().toISOString();

  const snapshotData: SharedListSnapshot = {
    list: { ...list, sharedId: sharedListId, ownerId },
    tasks,
    ownerId,
    ownerName,
    updatedAt: now,
  };

  const metaData: SharedListMeta = {
    id: sharedListId,
    ownerId,
    listId: list.id,
    ownerName,
    createdAt: now,
  };

  // Write both documents in a batch
  const batch = writeBatch(db);
  batch.set(doc(db, "sharedListSnapshots", sharedListId), snapshotData);
  batch.set(doc(db, "sharedLists", sharedListId), metaData);
  await batch.commit();

  return sharedListId;
}

// Deep-filter: remove undefined values from objects before writing to Firestore
// Firestore does NOT accept undefined - it must be null or omitted
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key];
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = value;
    }
  }
  return result;
}

export async function updateSharedSnapshot(
  sharedListId: string,
  list: TaskList,
  tasks: Task[],
  ownerId: string,
  ownerName?: string
): Promise<void> {
  const db = await getFirebaseDB();
  const safeOwnerId = ownerId ?? "";
  if (!safeOwnerId) {
    console.warn("[Firestore] updateSharedSnapshot called with empty ownerId, sharedListId:", sharedListId);
  }

  // Strip undefined from list (critical - Firestore rejects undefined)
  const safeList = {
    ...stripUndefined(list),
    sharedId: sharedListId,
    ownerId: safeOwnerId,
  };

  // Strip undefined from all tasks (deep-clean)
  const safeTasks = tasks.map((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = t as any;
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = val;
      }
    }
    return cleaned;
  });

  console.log("[Firestore] updateSharedSnapshot:", {
    sharedListId,
    ownerId: safeOwnerId,
    listKeys: Object.keys(safeList),
    listUndefinedKeys: Object.keys(list).filter(k => (list as unknown as Record<string, unknown>)[k] === undefined),
    taskCount: safeTasks.length,
    hasUndefinedTasks: tasks.some(t => Object.values(t).some(v => v === undefined)),
  });

  const snapshotData: SharedListSnapshot = {
    list: safeList as TaskList,
    tasks: safeTasks as unknown as Task[],
    ownerId: safeOwnerId,
    ownerName,
    updatedAt: Timestamp.now().toDate().toISOString(),
  };

  await setDoc(doc(db, "sharedListSnapshots", sharedListId), snapshotData);
}

export async function getSharedSnapshot(sharedListId: string): Promise<SharedListSnapshot | null> {
  const db = await getFirebaseDB();
  const snap = await getDoc(doc(db, "sharedListSnapshots", sharedListId));
  if (!snap.exists()) return null;
  const data = snap.data();
  console.log("[Firestore] getSharedSnapshot raw data for", sharedListId, {
    ownerId: data.ownerId,
    listOwnerId: data.list?.ownerId,
  });
  return data as SharedListSnapshot;
}

export async function subscribeToSharedSnapshot(
  sharedListId: string,
  onUpdate: (snapshot: SharedListSnapshot | null) => void,
  onDeleted?: () => void
): Promise<Unsubscribe> {
  const db = await getFirebaseDB();
  return onSnapshot(doc(db, "sharedListSnapshots", sharedListId), (snap) => {
    if (!snap.exists()) {
      onDeleted?.();
      onUpdate(null);
      return;
    }
    const data = snap.data();
    console.log("[Firestore] subscribeToSharedSnapshot raw data for", sharedListId, {
      ownerId: data.ownerId,
      listOwnerId: data.list?.ownerId,
      hasOwnerId: "ownerId" in data,
    });
    onUpdate(data as SharedListSnapshot);
  }, (error) => {
    // Handle permission denied or other errors
    if (error.code === "permission-denied" || error.code === "not-found") {
      onDeleted?.();
      onUpdate(null);
    }
  });
}

export async function deleteSharedList(sharedListId: string): Promise<void> {
  const db = await getFirebaseDB();
  const batch = writeBatch(db);
  batch.delete(doc(db, "sharedListSnapshots", sharedListId));
  batch.delete(doc(db, "sharedLists", sharedListId));
  await batch.commit();
}

export async function getSharedListMeta(sharedListId: string): Promise<SharedListMeta | null> {
  const db = await getFirebaseDB();
  const snap = await getDoc(doc(db, "sharedLists", sharedListId));
  if (!snap.exists()) return null;
  return snap.data() as SharedListMeta;
}
