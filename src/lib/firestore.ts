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
import { Task, TaskList, Habit, PomodoroSession, Tag } from "./types";

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
export function subscribeTasks(
  userId: string,
  onUpdate: (tasks: Task[]) => void
): Unsubscribe {
  const db = getFirebaseDB();
  const q = query(collection(db, tasksCol(userId)), orderBy("order"));
  return onSnapshot(q, (snap) => {
    const tasks: Task[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Task));
    onUpdate(tasks);
  });
}

export async function saveTask(userId: string, task: Task): Promise<void> {
  const db = getFirebaseDB();
  await setDoc(doc(db, tasksCol(userId), task.id), {
    ...task,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const db = getFirebaseDB();
  await deleteDoc(doc(db, tasksCol(userId), taskId));
}

export async function batchSaveTasks(userId: string, tasks: Task[]): Promise<void> {
  const db = getFirebaseDB();
  const batch = writeBatch(db);
  const now = Timestamp.now().toDate().toISOString();
  for (const task of tasks) {
    batch.set(doc(db, tasksCol(userId), task.id), { ...task, updatedAt: now });
  }
  await batch.commit();
}

// ─── 清單 ────────────────────────────────────────────────────
export function subscribeLists(
  userId: string,
  onUpdate: (lists: TaskList[]) => void
): Unsubscribe {
  const db = getFirebaseDB();
  const q = query(collection(db, listsCol(userId)), orderBy("createdAt"));
  return onSnapshot(q, (snap) => {
    const lists: TaskList[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TaskList));
    onUpdate(lists);
  });
}

export async function saveList(userId: string, list: TaskList): Promise<void> {
  const db = getFirebaseDB();
  await setDoc(doc(db, listsCol(userId), list.id), {
    ...list,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
}

export async function deleteList(userId: string, listId: string): Promise<void> {
  const db = getFirebaseDB();
  await deleteDoc(doc(db, listsCol(userId), listId));
}

// ─── 習慣 ────────────────────────────────────────────────────
export function subscribeHabits(
  userId: string,
  onUpdate: (habits: Habit[]) => void
): Unsubscribe {
  const db = getFirebaseDB();
  const q = query(collection(db, habitsCol(userId)), orderBy("createdAt"));
  return onSnapshot(q, (snap) => {
    const habits: Habit[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Habit));
    onUpdate(habits);
  });
}

export async function saveHabit(userId: string, habit: Habit): Promise<void> {
  const db = getFirebaseDB();
  await setDoc(doc(db, habitsCol(userId), habit.id), {
    ...habit,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const db = getFirebaseDB();
  await deleteDoc(doc(db, habitsCol(userId), habitId));
}

// ─── 番茄鐘 ─────────────────────────────────────────────────
export function subscribePomodoro(
  userId: string,
  onUpdate: (sessions: PomodoroSession[]) => void
): Unsubscribe {
  const db = getFirebaseDB();
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
  const db = getFirebaseDB();
  await setDoc(doc(db, pomodoroCol(userId), session.id), session);
}

// ─── 標籤 ────────────────────────────────────────────────────
export function subscribeTags(
  userId: string,
  onUpdate: (tags: Tag[]) => void
): Unsubscribe {
  const db = getFirebaseDB();
  const q = query(collection(db, tagsCol(userId)));
  return onSnapshot(q, (snap) => {
    const tags: Tag[] = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Tag));
    onUpdate(tags);
  });
}

export async function saveTag(userId: string, tag: Tag): Promise<void> {
  const db = getFirebaseDB();
  await setDoc(doc(db, tagsCol(userId), tag.id), tag);
}

// ─── 一次寫入所有預設清單（首次登入用）──────────────────────
export async function seedDefaultLists(userId: string, defaults: Omit<TaskList, "id" | "createdAt" | "updatedAt">[]): Promise<void> {
  const db = getFirebaseDB();
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
  const batch = writeBatch(getFirebaseDB());
  const now = Timestamp.now().toDate().toISOString();
  let taskCount = 0, habitCount = 0, listCount = 0;

  if (data.lists?.length) {
    for (const list of data.lists) {
      batch.set(doc(getFirebaseDB(), listsCol(userId), list.id), { ...list, updatedAt: now });
      listCount++;
    }
  }
  if (data.tasks?.length) {
    for (const task of data.tasks) {
      batch.set(doc(getFirebaseDB(), tasksCol(userId), task.id), { ...task, updatedAt: now });
      taskCount++;
    }
  }
  if (data.habits?.length) {
    for (const habit of data.habits) {
      batch.set(doc(getFirebaseDB(), habitsCol(userId), habit.id), { ...habit, updatedAt: now });
      habitCount++;
    }
  }

  await batch.commit();
  return { tasks: taskCount, habits: habitCount, lists: listCount };
}
