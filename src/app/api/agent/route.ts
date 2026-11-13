import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  DEFAULT_RHYTHM_SETTINGS,
  Habit,
  Task,
  HabitCheckin,
  RhythmProfile,
  RhythmSettings,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_FILE_PATH = path.join(process.cwd(), ".data", "user_state.json");

function getLocalToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function computeStreak(habit: Habit, checkins: HabitCheckin[]): number {
  if (checkins.length === 0) return 0;
  const sortedDates = checkins
    .filter((c) => c.completed)
    .map((c) => c.date)
    .sort()
    .reverse();

  const today = getLocalToday();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;

  let streak = 0;
  const dateSet = new Set(sortedDates);
  const d = new Date(sortedDates[0]);
  while (dateSet.has(d.toISOString().split("T")[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// 讀取本機鏡像檔案
function readLocalState(): { uid?: string; email?: string; habits?: Habit[]; tasks?: Task[]; lastSyncedAt?: string } | null {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const content = fs.readFileSync(STATE_FILE_PATH, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("[api/agent] readLocalState failed:", err);
  }
  return null;
}

// 寫入本機鏡像檔案
function writeLocalState(data: { uid?: string; email?: string; habits?: Habit[]; tasks?: Task[]; lastSyncedAt?: string }): void {
  try {
    const dir = path.dirname(STATE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[api/agent] writeLocalState failed:", err);
  }
}

// 取得 Supabase 管理員 Client（若環境變數存在）
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// 安全驗證
function verifyAgentAuth(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const agentKey = req.headers.get("x-agent-key") || req.nextUrl.searchParams.get("key");
  if (!agentKey) return false;
  const validKeys = [
    process.env.AGENT_API_KEY,
    process.env.CRON_SECRET,
    "vibelist-agent-key-2026",
  ].filter(Boolean) as string[];
  return validKeys.includes(agentKey);
}

// 解析目標使用者的 UID
async function resolveTargetUid(req: NextRequest, supabaseAdmin: any): Promise<{ uid: string; email?: string } | null> {
  const explicitUid = req.headers.get("x-user-uid") || req.nextUrl.searchParams.get("uid");
  if (explicitUid) return { uid: explicitUid };

  const explicitEmail = req.nextUrl.searchParams.get("email");
  const localState = readLocalState();

  const targetEmail =
    explicitEmail ||
    localState?.email ||
    process.env.AGENT_TARGET_EMAIL ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")[0]?.trim() ||
    "differ505@gmail.com";

  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      if (data?.users?.length) {
        const matched =
          data.users.find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()) ||
          data.users[0];
        if (matched?.id) {
          return { uid: matched.id, email: matched.email || targetEmail };
        }
      }
    } catch (err) {
      console.warn("[api/agent] resolveTargetUid via Supabase failed:", err);
    }
  }

  if (localState?.uid) {
    return { uid: localState.uid, email: localState.email };
  }

  return null;
}

// ── GET: 讀取習慣 / 任務 ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized: Invalid x-agent-key" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const target = await resolveTargetUid(req, supabaseAdmin);
  const localState = readLocalState();
  const type = req.nextUrl.searchParams.get("type") || "all";

  let habits: Habit[] = localState?.habits || [];
  let tasks: Task[] = localState?.tasks || [];
  let source = "local_mirror";

  if (supabaseAdmin && target?.uid) {
    try {
      // 讀取 habits
      const { data: habitRows } = await supabaseAdmin
        .from("personal_habits")
        .select("data")
        .eq("owner_uid", target.uid);

      if (habitRows) {
        habits = habitRows.map((r: any) => r.data as Habit);
        source = "supabase_cloud";
      }

      // 讀取 tasks
      const { data: taskRows } = await supabaseAdmin
        .from("personal_tasks")
        .select("data")
        .eq("owner_uid", target.uid);

      if (taskRows) {
        tasks = taskRows.map((r: any) => r.data as Task);
        source = "supabase_cloud";
      }

      // 順便快取一份到本機鏡像
      writeLocalState({
        uid: target.uid,
        email: target.email,
        habits,
        tasks,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn("[api/agent] Supabase fetch failed, falling back to localState:", err?.message);
    }
  }

  if (type === "habits") {
    return NextResponse.json({ ok: true, source, targetUid: target?.uid, count: habits.length, habits });
  }
  if (type === "tasks") {
    return NextResponse.json({ ok: true, source, targetUid: target?.uid, count: tasks.length, tasks });
  }

  return NextResponse.json({
    ok: true,
    source,
    targetUid: target?.uid,
    targetEmail: target?.email,
    habitsCount: habits.length,
    tasksCount: tasks.length,
    habits,
    tasks,
  });
}

// ── POST: 鏡像寫入、新增習慣、修改習慣、打卡、任務操作 ──────────
export async function POST(req: NextRequest) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized: Invalid x-agent-key" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, payload, uid: explicitUid } = body;

  const supabaseAdmin = getSupabaseAdmin();
  const localState = readLocalState();
  const targetUid = explicitUid || (await resolveTargetUid(req, supabaseAdmin))?.uid || localState?.uid;

  // 1. 處理前端瀏覽器傳來的全量鏡像 (mirror)
  if (action === "mirror") {
    const { uid, email, habits, tasks } = body;
    writeLocalState({
      uid: uid || targetUid,
      email,
      habits: habits || [],
      tasks: tasks || [],
      lastSyncedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, message: "Local mirror updated", lastSyncedAt: new Date().toISOString() });
  }

  // 檢查是否具有有效 targetUid
  if (!targetUid) {
    return NextResponse.json({ error: "Missing target user UID" }, { status: 400 });
  }

  // 2. 習慣操作
  if (action === "add_habit") {
    const habitData = payload || {};
    const id = habitData.id || `habit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const newHabit: Habit = {
      id,
      title: habitData.title || "未命名習慣",
      description: habitData.description || "",
      frequency: habitData.frequency || "daily",
      color: habitData.color || "#4F6AF5",
      targetCount: habitData.targetCount || 1,
      streak: 0,
      longestStreak: 0,
      checkins: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      pomodoroMinutes: habitData.pomodoroMinutes || 25,
      dailyTarget: habitData.dailyTargetMinutes
        ? { minutes: habitData.dailyTargetMinutes, minutesSetAt: getLocalToday() }
        : undefined,
    };

    if (supabaseAdmin) {
      await supabaseAdmin.from("personal_habits").upsert({
        id: newHabit.id,
        owner_uid: targetUid,
        data: newHabit,
        is_archived: false,
        updated_at: nowIso,
      });
    }

    // 更新 localState
    const currentHabits = localState?.habits || [];
    writeLocalState({
      ...localState,
      habits: [...currentHabits.filter((h) => h.id !== id), newHabit],
      lastSyncedAt: nowIso,
    });

    return NextResponse.json({ ok: true, action: "add_habit", habit: newHabit });
  }

  if (action === "update_habit") {
    const { id, updates } = payload || {};
    if (!id) return NextResponse.json({ error: "Missing habit id" }, { status: 400 });

    let existing: Habit | undefined;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.from("personal_habits").select("data").eq("id", id).eq("owner_uid", targetUid).single();
      existing = data?.data as Habit;
    }
    if (!existing) {
      existing = localState?.habits?.find((h) => h.id === id);
    }
    if (!existing) {
      return NextResponse.json({ error: `Habit ${id} not found` }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updatedHabit: Habit = {
      ...existing,
      ...updates,
      updatedAt: nowIso,
    };

    if (supabaseAdmin) {
      await supabaseAdmin.from("personal_habits").upsert({
        id: updatedHabit.id,
        owner_uid: targetUid,
        data: updatedHabit,
        is_archived: !!updatedHabit.archivedAt,
        updated_at: nowIso,
      });
    }

    const currentHabits = localState?.habits || [];
    writeLocalState({
      ...localState,
      habits: currentHabits.map((h) => (h.id === id ? updatedHabit : h)),
      lastSyncedAt: nowIso,
    });

    return NextResponse.json({ ok: true, action: "update_habit", habit: updatedHabit });
  }

  if (action === "checkin_habit") {
    const { id, date = getLocalToday(), count = 1, minutes, note } = payload || {};
    if (!id) return NextResponse.json({ error: "Missing habit id" }, { status: 400 });

    let existing: Habit | undefined;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.from("personal_habits").select("data").eq("id", id).eq("owner_uid", targetUid).single();
      existing = data?.data as Habit;
    }
    if (!existing) {
      existing = localState?.habits?.find((h) => h.id === id);
    }
    if (!existing) {
      return NextResponse.json({ error: `Habit ${id} not found` }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const existingCheckin = existing.checkins.find((c) => c.date === date);
    let checkins: HabitCheckin[];

    if (existingCheckin) {
      checkins = existing.checkins.map((c) =>
        c.date === date
          ? {
              ...c,
              completed: true,
              count: (c.count || 0) + count,
              minutes: minutes ? (c.minutes || 0) + minutes : c.minutes,
              note: note ?? c.note,
              lastRecordedAt: nowIso,
            }
          : c
      );
    } else {
      checkins = [
        ...existing.checkins,
        {
          date,
          completed: true,
          count,
          minutes,
          note,
          lastRecordedAt: nowIso,
        },
      ];
    }

    const streak = computeStreak(existing, checkins);
    const longestStreak = Math.max(existing.longestStreak, streak);

    const updatedHabit: Habit = {
      ...existing,
      checkins,
      streak,
      longestStreak,
      lastRecordedAt: nowIso,
      lastLoggedMinutes: minutes ?? existing.lastLoggedMinutes,
      updatedAt: nowIso,
    };

    if (supabaseAdmin) {
      await supabaseAdmin.from("personal_habits").upsert({
        id: updatedHabit.id,
        owner_uid: targetUid,
        data: updatedHabit,
        is_archived: !!updatedHabit.archivedAt,
        updated_at: nowIso,
      });
    }

    const currentHabits = localState?.habits || [];
    writeLocalState({
      ...localState,
      habits: currentHabits.map((h) => (h.id === id ? updatedHabit : h)),
      lastSyncedAt: nowIso,
    });

    return NextResponse.json({ ok: true, action: "checkin_habit", habit: updatedHabit });
  }

  // 3. 任務操作 (add_task, update_task, complete_task)
  if (action === "add_task") {
    const taskData = payload || {};
    const id = taskData.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const newTask: Task = {
      id,
      title: taskData.title || "未命名任務",
      description: taskData.description || "",
      priority: taskData.priority || "do-now",
      status: taskData.status || "todo",
      startDate: taskData.startDate,
      dueDate: taskData.dueDate,
      dueTime: taskData.dueTime,
      tags: taskData.tags || [],
      recurrence: taskData.recurrence,
      outputTarget: taskData.outputTarget,
      outputCount: taskData.outputCount ?? 0,
      isArchived: false,
      order: taskData.order || 0,
      focusMinutes: taskData.focusMinutes || 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      listId: taskData.listId,
    };

    if (supabaseAdmin) {
      await supabaseAdmin.from("personal_tasks").upsert({
        id: newTask.id,
        owner_uid: targetUid,
        data: newTask,
        is_archived: false,
        updated_at: nowIso,
      });
    }

    const currentTasks = localState?.tasks || [];
    writeLocalState({
      ...localState,
      tasks: [...currentTasks.filter((t) => t.id !== id), newTask],
      lastSyncedAt: nowIso,
    });

    return NextResponse.json({ ok: true, action: "add_task", task: newTask });
  }

  if (action === "delete_task") {
    const taskId = payload?.id as string | undefined;
    if (!taskId) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

    if (supabaseAdmin) {
      await supabaseAdmin
        .from("personal_tasks")
        .delete()
        .eq("id", taskId)
        .eq("owner_uid", targetUid);
    }

    const currentTasks = localState?.tasks || [];
    writeLocalState({
      ...localState,
      tasks: currentTasks.filter((t) => t.id !== taskId),
      lastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, action: "delete_task", id: taskId });
  }

  // 4. 節奏設定同步 (set_rhythm_profile)
  if (action === "set_rhythm_profile") {
    const rawSettings = (payload?.settings ?? payload ?? {}) as Partial<RhythmSettings>;
    const nowIso = new Date().toISOString();
    const settings: RhythmSettings = {
      ...DEFAULT_RHYTHM_SETTINGS,
      ...rawSettings,
      enabled: {
        ...DEFAULT_RHYTHM_SETTINGS.enabled,
        ...(rawSettings.enabled ?? {}),
      },
      themeDays: Array.isArray(rawSettings.themeDays)
        ? rawSettings.themeDays
        : DEFAULT_RHYTHM_SETTINGS.themeDays,
    };
    const profile: RhythmProfile = {
      id: "rhythm-profile",
      kind: "rhythm-profile",
      settings,
      updatedAt: nowIso,
    };

    if (supabaseAdmin) {
      await supabaseAdmin.from("personal_habits").upsert({
        id: profile.id,
        owner_uid: targetUid,
        data: profile,
        is_archived: false,
        updated_at: nowIso,
      });
    }

    return NextResponse.json({ ok: true, action: "set_rhythm_profile", profile });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
