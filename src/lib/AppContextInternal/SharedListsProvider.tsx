"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Task,
  TaskList,
  SharedListSnapshot,
} from "../types";
import {
  SharedListData,
  generateId,
  saveSharedList,
  getSharedLists,
  removeSharedList,
  saveOwnedSharedListIds,
  getOwnedSharedListIds,
  getMyRoleByList,
  saveMyRoleByList,
  saveLists,
  saveTasks,
} from "../storage";
import {
  createSharedList,
  updateSharedSnapshot,
  subscribeToSharedSnapshot,
  deleteSharedList,
  getSharedSnapshot,
  kickFromSharedList,
  bindCurrentUserToSharedList,
  getMyRoleInSharedList,
  listSharedMembers,
  setSharedTaskPosition,
} from "../firestore";
import { deleteTask as deleteTaskFirebase } from "../personalTaskSync";
import { batchSaveLists as batchSaveListsFirebase } from "../personalListSync";
import { SharedMember, MemberRole } from "../sharedSync";
import { parseNaturalLanguage } from "../nlp";
import { getLocalToday } from "../dateUtils";
import { toast } from "sonner";
import { appContextLog } from "./utils";

const log = appContextLog("SharedListsProvider");

// ── Context ─────────────────────────────────────────────────────
interface SharedListsContextValue {
  sharedLists: Record<string, SharedListData>;
  ownedSharedListIds: string[];
  acceptedSharedListIds: string[];
  myRoleByList: Record<string, MemberRole>;
  membersBySharedList: Record<string, SharedMember[]>;
  setOwnedSharedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  canEditSharedList: (sharedListId: string) => boolean;
  quickAddToShared: (sharedListId: string, input: string) => string | null;
  updateSharedTask: (sharedListId: string, taskId: string, updates: Partial<Task>) => void;
  deleteSharedTask: (sharedListId: string, taskId: string) => void;
  reorderSharedTask: (sharedListId: string, taskId: string, position: number) => Promise<void>;
  ensureSharedListData: (sharedListId: string) => Promise<SharedListData | null>;
  shareList: (listId: string) => Promise<string | null>;
  unshareList: (sharedListId: string) => Promise<void>;
  acceptSharedList: (sharedListId: string, data: SharedListSnapshot) => void;
  removeAcceptedSharedList: (sharedListId: string) => void;
  checkIncomingShareLink: () => Promise<{ sharedListId: string; snapshot: SharedListSnapshot } | null>;
  listSharedMembers: (sharedListId: string) => Promise<SharedMember[]>;
  inviteToSharedList: (sharedListId: string, email: string, role: MemberRole) => Promise<void>;
  kickFromSharedList: (sharedListId: string, email: string) => Promise<void>;
  changeSharedMemberRole: (sharedListId: string, email: string, role: MemberRole) => Promise<void>;
  getMyRole: (sharedListId: string) => MemberRole | null;
}

const SharedListsContext = createContext<SharedListsContextValue | null>(null);

export { SharedListsContext };

// ── Provider Props ─────────────────────────────────────────────
export interface SharedListsProviderProps {
  writeGuard: {
    recentlyWrittenListsRef: React.MutableRefObject<Map<string, number>>;
  };
  sharedLists: Record<string, SharedListData>;
  setSharedLists: React.Dispatch<React.SetStateAction<Record<string, SharedListData>>>;
  ownedSharedListIds: string[];
  setOwnedSharedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  acceptedSharedListIds: string[];
  setAcceptedSharedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  myRoleByList: Record<string, MemberRole>;
  setMyRoleByList: React.Dispatch<React.SetStateAction<Record<string, MemberRole>>>;
  membersBySharedList: Record<string, SharedMember[]>;
  setMembersBySharedList: React.Dispatch<React.SetStateAction<Record<string, SharedMember[]>>>;
  lists: TaskList[];
  setLists: React.Dispatch<React.SetStateAction<TaskList[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  userUid?: string;
  children: React.ReactNode;
}

// ── Provider ────────────────────────────────────────────────────
export function SharedListsProvider({
  writeGuard,
  sharedLists,
  setSharedLists,
  ownedSharedListIds,
  setOwnedSharedListIds,
  acceptedSharedListIds,
  setAcceptedSharedListIds,
  myRoleByList,
  setMyRoleByList,
  membersBySharedList,
  setMembersBySharedList,
  lists,
  setLists,
  tasks,
  setTasks,
  userUid,
  children,
}: SharedListsProviderProps) {
  // ── Internal Refs ─────────────────────────────────────
  const isWritingRef = useRef<Record<string, boolean>>({});
  const lastSyncedHashRef = useRef<Record<string, string>>({});
  const lastSyncedTaskCountRef = useRef<Record<string, number>>({});
  const snapshotReadyRef = useRef<Record<string, boolean>>({});
  const snapshotTasksRef = useRef<Record<string, Task[]>>({});
  const sharedListUnsubscribeRefs = useRef<Record<string, () => void>>({});
  const remoteSharedTasksRef = useRef<Record<string, Task[]>>({});
  const myEchoIdsRef = useRef<Set<string>>(new Set<string>());
  const recentlyWrittenListsRef = writeGuard.recentlyWrittenListsRef;

  // ── Derived State ─────────────────────────────────────
  const ownedSharedListIdsRef = useRef<string[]>([]);
  useEffect(() => {
    ownedSharedListIdsRef.current = ownedSharedListIds;
  }, [ownedSharedListIds]);

  // ── Helpers ────────────────────────────────────────────
  const canEditSharedList = useCallback((sharedListId: string): boolean => {
    if (ownedSharedListIds.includes(sharedListId)) return true;
    const role = myRoleByList[sharedListId];
    return role === "owner" || role === "editor";
  }, [myRoleByList, ownedSharedListIds]);

  const guardWrite = useCallback((sharedListId: string, fn: () => Promise<void>) => {
    isWritingRef.current[sharedListId] = true;
    return fn().finally(() => { isWritingRef.current[sharedListId] = false; });
  }, []);

  // ── Shared List CRUD ────────────────────────────────────
  const ensureSharedListData = useCallback(async (sharedListId: string): Promise<SharedListData | null> => {
    const existing = sharedLists[sharedListId];
    if (existing) return existing;
    const snapshot = await getSharedSnapshot(sharedListId);
    if (!snapshot) return null;
    const data: SharedListData = {
      list: { ...snapshot.list, ownerId: snapshot.ownerId || snapshot.list.ownerId },
      tasks: snapshot.tasks,
      ownerName: snapshot.ownerName,
    };
    saveSharedList(sharedListId, data);
    setSharedLists(getSharedLists());
    return data;
  }, [sharedLists, setSharedLists]);

  const quickAddToShared = useCallback((sharedListId: string, input: string): string | null => {
    if (!input.trim()) return null;
    if (!canEditSharedList(sharedListId)) {
      log.warn("Viewer cannot add tasks");
      return null;
    }
    const parsed = parseNaturalLanguage(input);
    const id = generateId();
    const now = new Date().toISOString();
    const task: Task = {
      id, title: parsed.title, description: parsed.description,
      priority: parsed.priority, status: "todo",
      dueDate: parsed.dueDate, dueTime: parsed.dueTime,
      tags: parsed.tags, listId: sharedListId,
      recurrence: parsed.recurrence, reminder: parsed.reminder,
      subTasks: [], createdAt: now, updatedAt: now,
      focusMinutes: 0, isArchived: false, order: 0,
      createdBy: userUid, ownerUid: userUid,
    };
    const data = sharedLists[sharedListId];
    if (!data) {
      void ensureSharedListData(sharedListId).then((fetchedData) => {
        if (!fetchedData) return;
        const updatedTasks = [task, ...fetchedData.tasks];
        const updatedData: SharedListData = { ...fetchedData, tasks: updatedTasks };
        saveSharedList(sharedListId, updatedData);
        setSharedLists(getSharedLists());
        const ownerId = fetchedData.list.ownerId ?? "";
        isWritingRef.current[sharedListId] = true;
        const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
        lastSyncedHashRef.current[sharedListId] = pendingHash;
        lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
        updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, fetchedData.ownerName, (sid, writtenTasks) => {
          const u = { ...fetchedData, tasks: writtenTasks };
          saveSharedList(sid, u);
          setSharedLists((prev) => ({ ...prev, [sid]: u }));
          snapshotTasksRef.current[sid] = writtenTasks;
          const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
          lastSyncedHashRef.current[sid] = hash;
          lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
          isWritingRef.current[sid] = false;
        }).catch((err) => {
          log.error("Failed to save task", err);
          isWritingRef.current[sharedListId] = false;
          saveSharedList(sharedListId, fetchedData);
          setSharedLists(getSharedLists());
        });
      });
      return id;
    }
    const updatedTasks = [task, ...data.tasks];
    // @ts-ignore
    window.appDebug?.(`updateSharedTask inside: found data, updated ${updatedTasks.length} tasks`);
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    const ownerId = data.list.ownerId ?? "";
    isWritingRef.current[sharedListId] = true;
    const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
    lastSyncedHashRef.current[sharedListId] = pendingHash;
    lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
    updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, data.ownerName, (sid, writtenTasks) => {
      const u = { ...data, tasks: writtenTasks };
      saveSharedList(sid, u);
      setSharedLists((prev) => ({ ...prev, [sid]: u }));
      snapshotTasksRef.current[sid] = writtenTasks;
      const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
      lastSyncedHashRef.current[sid] = hash;
      lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
      isWritingRef.current[sid] = false;
    }).catch((err) => {
      log.error("Failed to save task", err);
      isWritingRef.current[sharedListId] = false;
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
    return id;
  }, [sharedLists, userUid, ensureSharedListData, canEditSharedList, setSharedLists]);

  const updateSharedTask = useCallback((sharedListId: string, taskId: string, updates: Partial<Task>) => {
    if (!canEditSharedList(sharedListId)) {
      // @ts-ignore
      window.appDebug?.(`canEditSharedList returned FALSE for ${sharedListId}`);
      log.warn("Viewer cannot edit tasks");
      toast.error("您沒有此共享清單的編輯權限");
      return;
    }
    const currentSharedLists = getSharedLists();
    const data = currentSharedLists[sharedListId] || sharedLists[sharedListId];
    if (!data) {
      toast.error("找不到該共享清單資料");
      return;
    }
    
    const taskExists = data.tasks.some(t => t.id === taskId);
    if (!taskExists) {
      toast.error("在共享清單中找不到該任務");
      return;
    }

    const updatedTasks = data.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    const ownerId = data.list.ownerId ?? "";
    isWritingRef.current[sharedListId] = true;
    const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
    lastSyncedHashRef.current[sharedListId] = pendingHash;
    lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
    updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, data.ownerName, (sid, writtenTasks) => {
      setSharedLists((prev) => ({ ...prev, [sid]: { ...prev[sid], tasks: writtenTasks } }));
      saveSharedList(sid, { ...sharedLists[sid], tasks: writtenTasks });
      snapshotTasksRef.current[sid] = writtenTasks;
      const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
      lastSyncedHashRef.current[sid] = hash;
      lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
      isWritingRef.current[sid] = false;
    }).catch((err) => {
      log.error("Failed to update task", err);
      toast.error("同步至伺服器失敗，任務狀態已還原");
      isWritingRef.current[sharedListId] = false;
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
  }, [sharedLists, canEditSharedList, setSharedLists]);

  const deleteSharedTask = useCallback((sharedListId: string, taskId: string) => {
    if (!canEditSharedList(sharedListId)) {
      log.warn("Viewer cannot delete tasks");
      return;
    }
    const data = sharedLists[sharedListId];
    if (!data) return;
    const updatedTasks = data.tasks.filter((t) => t.id !== taskId);
    const updatedData: SharedListData = { ...data, tasks: updatedTasks };
    saveSharedList(sharedListId, updatedData);
    setSharedLists(getSharedLists());
    const ownerId = data.list.ownerId ?? "";
    isWritingRef.current[sharedListId] = true;
    const pendingHash = JSON.stringify(updatedTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
    lastSyncedHashRef.current[sharedListId] = pendingHash;
    lastSyncedTaskCountRef.current[sharedListId] = updatedTasks.length;
    updateSharedSnapshot(sharedListId, updatedData.list, updatedTasks, ownerId, data.ownerName, (sid, writtenTasks) => {
      setSharedLists((prev) => ({ ...prev, [sid]: { ...prev[sid], tasks: writtenTasks } }));
      saveSharedList(sid, { ...sharedLists[sid], tasks: writtenTasks });
      snapshotTasksRef.current[sid] = writtenTasks;
      const hash = JSON.stringify(writtenTasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
      lastSyncedHashRef.current[sid] = hash;
      lastSyncedTaskCountRef.current[sid] = writtenTasks.length;
      isWritingRef.current[sid] = false;
    }).catch((err) => {
      log.error("Failed to delete task", err);
      isWritingRef.current[sharedListId] = false;
      saveSharedList(sharedListId, data);
      setSharedLists(getSharedLists());
    });
  }, [sharedLists, canEditSharedList, setSharedLists]);

  const reorderSharedTask = useCallback(async (sharedListId: string, taskId: string, position: number) => {
    if (!canEditSharedList(sharedListId)) return;
    try {
      await setSharedTaskPosition(sharedListId, taskId, position);
    } catch (err) {
      log.warn("reorder failed", err);
    }
  }, [canEditSharedList]);

  // ── Share/Unshare ──────────────────────────────────────
  const shareList = useCallback(async (listId: string): Promise<string | null> => {
    if (!userUid) return null;
    const list = lists.find((l) => l.id === listId);
    if (!list) return null;
    const listTasks = tasks.filter((t) => t.listId === listId);
    const ownerName = userUid; // displayName/email would need to come from parent
    try {
      const sharedListId = await createSharedList(list, listTasks, userUid, ownerName, undefined);
      const updatedList = { ...list, sharedId: sharedListId, ownerId: userUid, updatedAt: new Date().toISOString() };
      const updatedLists = lists.map((l) => l.id === listId ? updatedList : l);
      setLists(updatedLists);
      recentlyWrittenListsRef.current.set(listId, Date.now());
      saveLists(updatedLists);
      batchSaveListsFirebase(userUid, [updatedList]).catch((err) => log.warn("shareList sync failed", err));
      if (listTasks.length > 0) {
        const movedIds = new Set(listTasks.map((t) => t.id));
        const remainingTasks = tasks.filter((t) => !movedIds.has(t.id));
        setTasks(remainingTasks);
        saveTasks(remainingTasks);
        if (userUid) {
          listTasks.forEach((t) => {
            deleteTaskFirebase(userUid, t.id).catch((err) => log.warn(`shareList delete personal task ${t.id} failed`, err));
          });
        }
      }
      setOwnedSharedListIds((prev) =>
        prev.includes(sharedListId) ? prev : [...prev, sharedListId]
      );
      setMyRoleByList((prev) => ({ ...prev, [sharedListId]: "owner" }));
      return sharedListId;
    } catch (error: unknown) {
      log.error("createSharedList failed", error);
      throw error;
    }
  }, [userUid, lists, tasks, setLists, setTasks, setOwnedSharedListIds, setMyRoleByList]);

  const unshareList = useCallback(async (sharedListId: string): Promise<void> => {
    if (!userUid) return;
    try {
      await deleteSharedList(sharedListId);
      const changedList = lists.find(l => l.sharedId === sharedListId);
      const updatedLists = lists.map((l) =>
        l.sharedId === sharedListId ? { ...l, sharedId: undefined, ownerId: undefined, updatedAt: new Date().toISOString() } : l
      );
      setLists(updatedLists);
      if (changedList) {
        recentlyWrittenListsRef.current.set(changedList.id, Date.now());
        saveLists(updatedLists);
        batchSaveListsFirebase(userUid, [{ ...changedList, sharedId: undefined, ownerId: undefined, updatedAt: new Date().toISOString() }]).catch((err) => log.warn("unshareList sync failed", err));
      }
      setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
      if (sharedListUnsubscribeRefs.current[sharedListId]) {
        sharedListUnsubscribeRefs.current[sharedListId]();
        delete sharedListUnsubscribeRefs.current[sharedListId];
      }
    } catch (error) {
      log.error("Failed to unshare list", error);
    }
  }, [userUid, lists, setLists, setOwnedSharedListIds]);

  const acceptSharedList = useCallback(async (sharedListId: string, _data: SharedListSnapshot): Promise<void> => {
    if (!userUid) return;
    try {
      await bindCurrentUserToSharedList({ sharedListId, memberUid: userUid, memberEmail: "" });
    } catch (err) {
      log.error("accept invite failed (likely not invited)", err);
      return;
    }
    const snapshot = await getSharedSnapshot(sharedListId);
    if (!snapshot) return;
    const existing = getSharedLists();
    const duplicate = Object.entries(existing).find(
      ([id, d]) =>
        id !== sharedListId && d.list.name === snapshot.list.name &&
        d.list.ownerId === (snapshot.ownerId || snapshot.list.ownerId)
    );
    if (duplicate) {
      log.warn(`跳過重複加入：${snapshot.list.name}`);
      return;
    }
    const ownerId = snapshot.ownerId || snapshot.list.ownerId;
    const listWithDefaults: TaskList = {
      ...snapshot.list, ownerId,
      icon: snapshot.list.icon || "📋",
      color: snapshot.list.color || "#3B82F6",
    };
    const sharedData: SharedListData = {
      list: listWithDefaults,
      tasks: snapshot.tasks,
      ownerName: snapshot.ownerName,
    };
    saveSharedList(sharedListId, sharedData);
    setSharedLists(getSharedLists());
    const myRole = await getMyRoleInSharedList(sharedListId, userUid);
    if (myRole) {
      setMyRoleByList((prev) => ({ ...prev, [sharedListId]: myRole }));
    }
    if (!acceptedSharedListIds.includes(sharedListId)) {
      setAcceptedSharedListIds((prev) => [...prev, sharedListId]);
    }
  }, [userUid, acceptedSharedListIds, setSharedLists, setMyRoleByList, setAcceptedSharedListIds]);

  const removeAcceptedSharedList = useCallback((sharedListId: string): void => {
    removeSharedList(sharedListId);
    setSharedLists(getSharedLists());
    setAcceptedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
    setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
    setMyRoleByList((prev) => {
      const { [sharedListId]: _, ...rest } = prev;
      return rest;
    });
    if (sharedListUnsubscribeRefs.current[sharedListId]) {
      sharedListUnsubscribeRefs.current[sharedListId]();
      delete sharedListUnsubscribeRefs.current[sharedListId];
    }
  }, [setSharedLists, setAcceptedSharedListIds, setOwnedSharedListIds, setMyRoleByList]);

  const checkIncomingShareLink = useCallback(async (): Promise<{ sharedListId: string; snapshot: SharedListSnapshot } | null> => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get("share");
    if (!shareParam) return null;
    window.history.replaceState({}, "", window.location.pathname);
    try {
      const snapshot = await getSharedSnapshot(shareParam);
      if (snapshot) return { sharedListId: shareParam, snapshot };
    } catch (error) {
      log.error("Failed to fetch shared list", error);
    }
    return null;
  }, []);

  // ── Members API ─────────────────────────────────────
  const listSharedMembersFn = useCallback(async (sharedListId: string): Promise<SharedMember[]> => {
    const members = await listSharedMembers(sharedListId);
    setMembersBySharedList((prev) => ({ ...prev, [sharedListId]: members }));
    return members;
  }, [setMembersBySharedList]);

  const inviteToSharedListFn = useCallback(async (sharedListId: string, email: string, role: MemberRole) => {
    const myRole = myRoleByList[sharedListId];
    if (myRole !== "owner") throw new Error("Only owner can invite");
    const { supabase } = await import("../supabase");
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.from("shared_list_members").upsert(
      { shared_list_id: sharedListId, member_email: email.toLowerCase(), role: role === "owner" ? "editor" : role, status: "pending", invited_at: new Date().toISOString() },
      { onConflict: "shared_list_id,member_email" }
    );
    if (error) throw error;
    await listSharedMembersFn(sharedListId);
  }, [myRoleByList, listSharedMembersFn]);

  const kickFromSharedListFn = useCallback(async (sharedListId: string, email: string) => {
    const myRole = myRoleByList[sharedListId];
    if (myRole !== "owner") throw new Error("Only owner can remove members");
    await kickFromSharedList(sharedListId, email);
    await listSharedMembersFn(sharedListId);
  }, [myRoleByList, listSharedMembersFn]);

  const changeSharedMemberRole = useCallback(async (sharedListId: string, email: string, role: MemberRole) => {
    const myRole = myRoleByList[sharedListId];
    if (myRole !== "owner") throw new Error("Only owner can change roles");
    const { supabase } = await import("../supabase");
    if (!supabase) return;
    await supabase.from("shared_list_members").update({ role }).eq("shared_list_id", sharedListId).eq("member_email", email.toLowerCase());
    await listSharedMembersFn(sharedListId);
  }, [myRoleByList, listSharedMembersFn]);

  const getMyRole = useCallback((sharedListId: string): MemberRole | null => {
    return myRoleByList[sharedListId] ?? null;
  }, [myRoleByList, ownedSharedListIds]);

  // ── Subscription Effects ───────────────────────────────
  // ── 訂閱 owned shared list ──────────────────────────────
  useEffect(() => {
    if (!userUid || ownedSharedListIds.length === 0) return;
    const ownedSet = new Set(ownedSharedListIds);
    const promises: Promise<void>[] = [];
    ownedSharedListIds.forEach((sharedId) => {
      if (sharedListUnsubscribeRefs.current[sharedId]) return;
      const promise = subscribeToSharedSnapshot(
        sharedId,
        (snapshot) => {
          if (!snapshot) return;
          const isFirstSnapshot = !snapshotReadyRef.current[sharedId];
          snapshotReadyRef.current[sharedId] = true;
          const snapshotOwnerId = snapshot.ownerId || snapshot.list.ownerId;
          const updatedData: SharedListData = {
            list: { ...snapshot.list, ownerId: snapshotOwnerId },
            tasks: snapshot.tasks,
            ownerName: snapshot.ownerName,
          };
          if (isWritingRef.current[sharedId]) {
            snapshotTasksRef.current[sharedId] = snapshot.tasks;
            return;
          }
          const snapshotHash = JSON.stringify(snapshot.tasks.map((t) => `${t.id}:${t.updatedAt}`).sort());
          if (lastSyncedHashRef.current[sharedId] === snapshotHash) return;
          lastSyncedHashRef.current[sharedId] = snapshotHash;
          lastSyncedTaskCountRef.current[sharedId] = snapshot.tasks.length;
          setSharedLists((prev) => ({ ...prev, [sharedId]: updatedData }));
          const remoteTasks = snapshot.tasks.filter((t) => t.createdBy && t.createdBy !== userUid);
          remoteSharedTasksRef.current[sharedId] = remoteTasks;
          snapshotTasksRef.current[sharedId] = snapshot.tasks;
          void isFirstSnapshot;
        },
        () => {
          setOwnedSharedListIds((prev) => prev.filter((id) => id !== sharedId));
          setSharedLists((prev) => {
            const next = { ...prev };
            delete next[sharedId];
            return next;
          });
          removeSharedList(sharedId);
          delete remoteSharedTasksRef.current[sharedId];
          delete lastSyncedHashRef.current[sharedId];
          delete snapshotReadyRef.current[sharedId];
        }
      ).then((unsub) => {
        sharedListUnsubscribeRefs.current[sharedId] = unsub;
      }).catch(() => {});
      promises.push(promise);
    });
    return () => {
      Object.keys(sharedListUnsubscribeRefs.current).forEach((id) => {
        if (!ownedSet.has(id)) {
          sharedListUnsubscribeRefs.current[id]();
          delete sharedListUnsubscribeRefs.current[id];
          delete remoteSharedTasksRef.current[id];
          delete lastSyncedHashRef.current[id];
          delete snapshotReadyRef.current[id];
        }
      });
    };
  }, [userUid, ownedSharedListIds, setSharedLists, setOwnedSharedListIds]);

  // ── 訂閱 accepted shared list ─────────────────────────
  useEffect(() => {
    if (!userUid || acceptedSharedListIds.length === 0) return;
    const acceptedSet = new Set(acceptedSharedListIds);
    acceptedSharedListIds.forEach((sharedListId) => {
      if (sharedListUnsubscribeRefs.current[sharedListId]) return;
      subscribeToSharedSnapshot(
        sharedListId,
        (snapshot) => {
          if (!snapshot) return;
          const snapshotOwnerId = snapshot.ownerId || snapshot.list.ownerId;
          const snapshotListWithDefaults: TaskList = {
            ...snapshot.list, ownerId: snapshotOwnerId,
            icon: snapshot.list.icon || "📋",
            color: snapshot.list.color || "#3B82F6",
          };
          const updatedData: SharedListData = {
            list: snapshotListWithDefaults,
            tasks: snapshot.tasks,
            ownerName: snapshot.ownerName,
          };
          if (!snapshotReadyRef.current[sharedListId]) {
            saveSharedList(sharedListId, updatedData);
          }
          snapshotReadyRef.current[sharedListId] = true;
          setSharedLists((prev) => ({ ...prev, [sharedListId]: updatedData }));
          setSharedLists(getSharedLists());
        },
        () => {
          removeSharedList(sharedListId);
          setSharedLists(getSharedLists());
          setAcceptedSharedListIds((prev) => prev.filter((id) => id !== sharedListId));
          if (sharedListUnsubscribeRefs.current[sharedListId]) {
            delete sharedListUnsubscribeRefs.current[sharedListId];
          }
        }
      ).then((unsub) => {
        sharedListUnsubscribeRefs.current[sharedListId] = unsub;
      }).catch(() => {});
    });
    return () => {
      Object.keys(sharedListUnsubscribeRefs.current).forEach((id) => {
        if (!acceptedSet.has(id)) {
          sharedListUnsubscribeRefs.current[id]();
          delete sharedListUnsubscribeRefs.current[id];
        }
      });
    };
  }, [userUid, acceptedSharedListIds, setSharedLists, setAcceptedSharedListIds]);

  // ── 拉回自己身份 ───────────────────────────────
  useEffect(() => {
    if (!userUid) return;
    const listSharedIds = lists.map(l => l.sharedId).filter(Boolean) as string[];
    const allIds = Array.from(new Set([...ownedSharedListIds, ...acceptedSharedListIds, ...listSharedIds]));
    allIds.forEach(async (sid) => {
      if (myRoleByList[sid]) return;
      const r = await getMyRoleInSharedList(sid, userUid);
      if (r) setMyRoleByList((prev) => ({ ...prev, [sid]: r }));
    });
  }, [userUid, ownedSharedListIds, acceptedSharedListIds, lists, myRoleByList, setMyRoleByList]);

  // ── Context Value ─────────────────────────────────────
  const value: SharedListsContextValue = {
    sharedLists,
    ownedSharedListIds,
    acceptedSharedListIds,
    myRoleByList,
    membersBySharedList,
    setOwnedSharedListIds,
    canEditSharedList,
    quickAddToShared,
    updateSharedTask,
    deleteSharedTask,
    reorderSharedTask,
    ensureSharedListData,
    shareList,
    unshareList,
    acceptSharedList,
    removeAcceptedSharedList,
    checkIncomingShareLink,
    listSharedMembers: listSharedMembersFn,
    inviteToSharedList: inviteToSharedListFn,
    kickFromSharedList: kickFromSharedListFn,
    changeSharedMemberRole,
    getMyRole,
  };

  return (
    <SharedListsContext.Provider value={value}>
      {children}
    </SharedListsContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────
export function useSharedListsContext(): SharedListsContextValue {
  const ctx = useContext(SharedListsContext);
  if (!ctx) {
    throw new Error("useSharedListsContext must be used within a <SharedListsProvider>");
  }
  return ctx;
}
