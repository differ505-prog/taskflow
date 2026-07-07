"use client";

/**
 * Smoke test for Supabase Realtime shared list sync.
 *
 * Usage:
 *  1. Open /smoketest in Browser A
 *  2. Open /smoketest?user=b in Browser B (different email)
 *  3. A clicks "Create Shared List" → copy the sharedId
 *  4. B pastes sharedId + clicks "Subscribe"
 *  5. Both can add / toggle / delete tasks and see real-time updates
 */

import { useEffect, useRef, useState } from "react";
import {
  ensureSharedList,
  inviteMember,
  upsertSharedTasks,
  deleteSharedTask as supabaseDeleteSharedTask,
  fetchSharedSnapshot,
  subscribeToSharedList,
  acceptInvite,
  SharedSnapshot,
} from "@/lib/sharedSync";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Task, TaskList } from "@/lib/types";

const USER_KEY = "smoketest_user";
function getOrCreateUser(): string {
  if (typeof window === "undefined") return "anon";
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("user");
  if (forced) {
    localStorage.setItem(USER_KEY, forced);
    return forced;
  }
  let u = localStorage.getItem(USER_KEY);
  if (!u) {
    u = `u_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(USER_KEY, u);
  }
  return u;
}

function makeTask(title: string): Task {
  const now = new Date().toISOString();
  return {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    priority: "medium",
    status: "todo",
    createdAt: now,
    updatedAt: now,
    tags: [],
    isArchived: false,
    focusMinutes: 0,
    order: 0,
    createdBy: getOrCreateUser(),
  };
}

export default function SmokeTestPage() {
  const [user, setUser] = useState("anon");
  const [sharedId, setSharedId] = useState("");
  const [peerEmail, setPeerEmail] = useState("");
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setUser(getOrCreateUser());
  }, []);

  function appendLog(msg: string) {
    setLog((prev) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50)
    );
    console.log("[smoketest]", msg);
  }

  // Auto-subscribe when sharedId is set
  useEffect(() => {
    if (!sharedId || !isSupabaseConfigured()) return;
    appendLog(`Subscribing to ${sharedId} as ${user}…`);

    const unsub = subscribeToSharedList(sharedId, (snap) => {
      appendLog(
        `Received snapshot: ${snap ? snap.tasks.length + " tasks" : "null (deleted?)"}`
      );
      setSnapshot(snap);
    });
    unsubRef.current = unsub;

    return () => {
      appendLog("Unsubscribing");
      unsubRef.current = null;
      unsub();
    };
  }, [sharedId, user]);

  async function handleCreate() {
    if (!user) return;
    const id = `sl_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const list: TaskList = {
      id: id,
      name: "Smoke Test List",
      icon: "🧪",
      color: "#3B82F6",
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: user,
      sharedId: id,
    };
    try {
      await ensureSharedList({
        sharedListId: id,
        ownerUid: user,
        ownerEmail: `${user}@test.local`,
        ownerName: user,
        list,
      });
      // Seed with 1 task
      await upsertSharedTasks(id, [makeTask("Hello from " + user)]);
      setSharedId(id);
      appendLog(`Created shared list ${id}`);
    } catch (e: any) {
      appendLog(`Create failed: ${e.message}`);
    }
  }

  async function handleInvite() {
    if (!sharedId || !peerEmail) return;
    try {
      await inviteMember({ sharedListId: sharedId, memberEmail: peerEmail, role: "editor" });
      appendLog(`Invited ${peerEmail}`);
    } catch (e: any) {
      appendLog(`Invite failed: ${e.message}`);
    }
  }

  async function handleJoin() {
    if (!sharedId) return;
    try {
      // bind current user as member of this list（透過 RPC，含 email 比對）
      await acceptInvite({
        sharedListId: sharedId,
        callerUid: user,
        callerEmail: `${user}@test.local`,
      });
      appendLog(`Joined ${sharedId}`);
      // Trigger refetch by toggling sharedId
      const existing = sharedId;
      setSharedId("");
      setTimeout(() => setSharedId(existing), 100);
    } catch (e: any) {
      appendLog(`Join failed: ${e.message}`);
    }
  }

  async function handleAddTask() {
    if (!sharedId || !newTaskTitle.trim()) return;
    const task = makeTask(newTaskTitle.trim());
    try {
      const existing = snapshot?.tasks ?? [];
      await upsertSharedTasks(sharedId, [task]);
      // Optimistic local update
      if (snapshot) {
        setSnapshot({ ...snapshot, tasks: [task, ...existing] });
      }
      appendLog(`Added task "${task.title}"`);
      setNewTaskTitle("");
    } catch (e: any) {
      appendLog(`Add task failed: ${e.message}`);
    }
  }

  async function handleToggle(taskId: string) {
    if (!sharedId || !snapshot) return;
    const updated = snapshot.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: t.status === "done" ? ("todo" as const) : ("done" as const),
            updatedAt: new Date().toISOString(),
          }
        : t
    );
    setSnapshot({ ...snapshot, tasks: updated });
    try {
      const changed = updated.find((t) => t.id === taskId)!;
      await upsertSharedTasks(sharedId, [changed]);
      appendLog(`Toggled "${changed.title}" → ${changed.status}`);
    } catch (e: any) {
      appendLog(`Toggle failed: ${e.message}`);
    }
  }

  async function handleDelete(taskId: string) {
    if (!sharedId || !snapshot) return;
    setSnapshot({ ...snapshot, tasks: snapshot.tasks.filter((t) => t.id !== taskId) });
    try {
      await supabaseDeleteSharedTask(sharedId, taskId);
      appendLog(`Deleted task ${taskId}`);
    } catch (e: any) {
      appendLog(`Delete failed: ${e.message}`);
    }
  }

  async function handleReconnect() {
    if (!sharedId) return;
    appendLog("Manual re-fetch…");
    const snap = await fetchSharedSnapshot(sharedId);
    if (snap) {
      setSnapshot(snap);
      appendLog(`Re-fetched ${snap.tasks.length} tasks`);
    } else {
      appendLog("Re-fetch: list not found");
    }
  }

  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">🧪 Collab Smoke Test</h1>
          <p className="mt-1 text-sm text-slate-600">
            User: <code className="rounded bg-slate-200 px-1">{user}</code>
            {supabaseReady ? (
              <span className="ml-3 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                Supabase ready
              </span>
            ) : (
              <span className="ml-3 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                Supabase NOT configured
              </span>
            )}
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700">1. Setup</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleCreate}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Create shared list
            </button>
            <input
              value={sharedId}
              onChange={(e) => setSharedId(e.target.value)}
              placeholder="or paste sharedListId here"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={peerEmail}
              onChange={(e) => setPeerEmail(e.target.value)}
              placeholder="peer email to invite"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleInvite}
              disabled={!sharedId || !peerEmail}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Invite peer
            </button>
            <button
              onClick={handleJoin}
              disabled={!sharedId}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              I want to join
            </button>
            <button
              onClick={handleReconnect}
              disabled={!sharedId}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Manual re-fetch
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700">
            2. Tasks ({snapshot?.tasks.length ?? 0})
          </h2>
          <div className="mt-3 flex gap-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              placeholder="New task title"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleAddTask}
              disabled={!sharedId}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {snapshot?.tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 py-2"
                data-testid="task-row"
              >
                <button
                  onClick={() => handleToggle(t.id)}
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    t.status === "done"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {t.status === "done" ? "✓" : ""}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    t.status === "done" ? "text-slate-400 line-through" : ""
                  }`}
                >
                  {t.title}{" "}
                  <span className="text-xs text-slate-400">
                    ({t.createdBy})
                  </span>
                </span>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs text-slate-100">
          <h2 className="text-sm font-medium">Event log</h2>
          <ul className="mt-2 space-y-1 font-mono">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>

        <footer className="text-xs text-slate-500">
          <p>
            Test scenario: open this page in two browsers (or use{" "}
            <code>?user=b</code> query string). Both should see live updates
            within ~500ms.
          </p>
        </footer>
      </div>
    </div>
  );
}