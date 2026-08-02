import { supabase, isSupabaseConfigured } from "./supabase";
import type { Task, TaskList } from "./types";

/**
 * Shared-list realtime sync layer (Supabase) — v3.
 *
 * Design:
 *  - Postgres rows are the source of truth.
 *  - `shared_lists`         : 清單 metadata
 *  - `shared_list_members`  : 成員（含 role / status / 邀請時間）
 *  - `shared_tasks`         : 每個任務獨立 row + position (排序欄位)
 *
 * 安全機制（2026-08-03 修憲）：
 *  - 客戶端用 Supabase Auth（OAuth + email，見 src/lib/AuthContext.tsx）
 *    由 /api/auth/session 透過 setSession 把 sb-auth-token cookie 寫入，
 *    supabase client 自動讀取 → RLS 的 auth.uid() 才能正確解析當前登入者。
 *  - 寫入路徑走 SECURITY DEFINER RPC（見 supabase/migrations/0019）：
 *      create_shared_list_v2  解決「owner 第一次建立清單」雞生蛋問題
 *      （migration 0019 系列尚未涵蓋的寫入路徑：upsertSharedTasks /
 *       inviteMember / removeMember / changeMemberRole / deleteSharedList）
 *  - 接受邀請時用 accept_invite RPC（migration 0002）做 email 比對
 *    確保只有被邀請者本人能把自己 bind 到 member row。
 *
 * 排序：
 *  - 每個任務的 `position` 是 double。
 *  - 新增時塞 `(max + 1024)` 以保留插入空間。
 *  - 拖曳到 i 與 i+1 之間時，新位置 = (pos[i] + pos[i+1]) / 2。
 *  - 任兩者差距過小 (<1e-6) 時，重新 normalize 整列。
 */

export type MemberRole = "owner" | "editor" | "viewer";

export interface SharedMember {
  id: string;
  sharedListId: string;
  memberEmail: string;
  memberUid: string | null;
  role: MemberRole;
  status: "pending" | "active" | "removed";
  invitedAt: string;
  acceptedAt: string | null;
}

export interface SharedSnapshot {
  list: TaskList;
  tasks: Task[];
  ownerName: string;
}

// ── 排序輔助：為新任務決定 position ────────────────────────────
export async function nextTaskPosition(sharedListId: string): Promise<number> {
  if (!supabase) return Date.now();
  const { data, error } = await supabase
    .from("shared_tasks")
    .select("position")
    .eq("shared_list_id", sharedListId)
    .order("position", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return 1024;
  return (data[0] as any).position + 1024;
}

/** 把兩個 double 夾出中位數；若太擠則 nudge（呼叫端決定是否 normalize） */
export function midPosition(a: number, b: number): number {
  return (a + b) / 2;
}

/** 重排後若 gap 過小，重新 normalize 整列為 i * 1024 開頭 */
export function renormalizePositions(positions: number[]): number[] {
  return positions.map((_, i) => (i + 1) * 1024);
}

// ── Owner: 建立清單（含 owner 自己為 active member）────────────
// v3 改用 SECURITY DEFINER RPC（migration 0019）避免 RLS 雞生蛋：
//   - 舊版直接 upsert shared_lists + shared_list_members 兩張表，
//     撞上 sl_write / slm_owner_all 的 owner_uid = auth.uid() 比對。
//     在「第一次建立清單」時 owner member row 還不存在就被擋。
//   - 新版用 create_shared_list_v2 RPC，function 內部繞過 RLS，
//     並驗證 caller auth.uid() == p_owner_uid 才寫入。
export async function ensureSharedList(args: {
  sharedListId: string;
  ownerUid: string;
  ownerEmail: string | null;
  ownerName: string;
  list: TaskList;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { sharedListId, ownerUid, ownerEmail, ownerName, list } = args;

  const { error } = await supabase.rpc("create_shared_list_v2", {
    p_sid: sharedListId,
    p_owner_uid: ownerUid,
    p_owner_email: ownerEmail,
    p_owner_name: ownerName,
    p_name: list.name,
    p_icon: list.icon || "📋",
    p_color: list.color || "#3B82F6",
  });
  if (error) throw error;
}

// ── Owner: 邀請成員 ───────────────────────────────────────────
// v3 改用 SECURITY DEFINER RPC（migration 0020）繞過 slm_owner_all RLS
export async function inviteMember(args: {
  sharedListId: string;
  memberEmail: string;
  role: MemberRole;
}): Promise<SharedMember> {
  if (!supabase) throw new Error("Supabase not configured");
  const email = args.memberEmail.toLowerCase();

  const { data, error } = await supabase.rpc("invite_member_v2", {
    p_sid: args.sharedListId,
    p_member_email: email,
    p_role: args.role,
  });
  if (error) throw error;
  // rpc 預設回傳單一 row；若 .single() 沒給則包成陣列，需相容舊行為
  return mapMemberRow(Array.isArray(data) ? data[0] : data);
}

// ── Recipient: 接受邀請（必須 email 自報且符合 pending row）───
// 注意：補釘 #3 — 在寫入時必須再次比對目前登入使用者的 email 是否真為「被邀請者」。
// 我們用 caller-supplied 兩個欄位完成這層檢查：
//   1) callerUid      = auth.uid
//   2) callerEmail    = auth.email (lowercase)
// server 端最終寫入由 `accept_invite` RPC（見 migration）執行，
// function 內會再次比對 callerEmail == member.member_email，否則 raise exception。
export async function acceptInvite(args: {
  sharedListId: string;
  callerUid: string;
  callerEmail: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  // RPC：後端檢查 email 一致才更新（補釘 #3）
  const { error } = await supabase.rpc("accept_invite", {
    sid: args.sharedListId,
    uid: args.callerUid,
    email: args.callerEmail.toLowerCase(),
  });
  if (error) throw error;
}

// ── Owner: 移除成員（軟刪除：status='removed'）────────────────
// v3 改用 SECURITY DEFINER RPC（migration 0020）繞過 slm_owner_all RLS
export async function removeMember(args: {
  sharedListId: string;
  memberEmail: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("remove_member_v2", {
    p_sid: args.sharedListId,
    p_member_email: args.memberEmail.toLowerCase(),
  });
  if (error) throw error;
}

// ── Owner: 變更成員角色 ─────────────────────────────────────────
// v3 改用 SECURITY DEFINER RPC（migration 0020）繞過 slm_owner_all RLS
export async function changeMemberRole(args: {
  sharedListId: string;
  memberEmail: string;
  role: MemberRole;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("change_member_role_v2", {
    p_sid: args.sharedListId,
    p_member_email: args.memberEmail.toLowerCase(),
    p_role: args.role,
  });
  if (error) throw error;
}

// ── 查詢：自己在此清單的身分 ──────────────────────────────────
export async function getMyRole(args: {
  sharedListId: string;
  callerUid: string;
}): Promise<MemberRole | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("shared_list_members")
    .select("role,status")
    .eq("shared_list_id", args.sharedListId)
    .eq("member_uid", args.callerUid)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return data.role as MemberRole;
}

// ── 查詢：取得成員名單 ─────────────────────────────────────────
export async function listMembers(sharedListId: string): Promise<SharedMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("shared_list_members")
    .select("*")
    .eq("shared_list_id", sharedListId)
    .order("invited_at", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map(mapMemberRow);
}

// ── 查詢：查出所有「我參與的」清單 id ──────────────────────────
export async function fetchMySharedListIds(uid: string): Promise<string[]> {
  if (!supabase) return [];
  const [{ data: owned }, { data: joined }] = await Promise.all([
    supabase.from("shared_lists").select("id").eq("owner_uid", uid),
    supabase
      .from("shared_list_members")
      .select("shared_list_id")
      .eq("member_uid", uid)
      .eq("status", "active"),
  ]);
  const ids = new Set<string>();
  (owned || []).forEach((r: any) => ids.add(r.id));
  (joined || []).forEach((r: any) => ids.add(r.shared_list_id));
  return Array.from(ids);
}

// ── 任務 CRUD：upsert / delete / setPosition ────────────────────
// v3 改用 SECURITY DEFINER RPC（migration 0020）繞過 st_write RLS
export async function upsertSharedTasks(
  sharedListId: string,
  tasks: Task[]
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  if (tasks.length === 0) return;

  // 讀現有 positions 做 nudge，避免撞 key（SELECT 路徑，不被 st_write RLS 擋）
  const { data: posRows } = await supabase
    .from("shared_tasks")
    .select("id,position")
    .eq("shared_list_id", sharedListId);

  const posMap = new Map<string, number>();
  (posRows || []).forEach((r: any) => posMap.set(r.id, r.position as number));

  let cursor = await nextTaskPosition(sharedListId);
  const tasksJson = tasks.map((t) => {
    let position = posMap.get(t.id);
    if (position === undefined) {
      position = cursor;
      cursor += 1024;
    }
    return {
      id: t.id,
      data: stripUndefined(t),
      position,
    };
  });

  const { error } = await supabase.rpc("upsert_shared_tasks_v2", {
    p_sid: sharedListId,
    p_tasks: tasksJson,
  });
  if (error) throw error;
}

export async function deleteSharedTask(
  sharedListId: string,
  taskId: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  // v3 改用 SECURITY DEFINER RPC（migration 0020）繞過 st_write RLS
  const { error } = await supabase.rpc("delete_shared_task_v2", {
    p_sid: sharedListId,
    p_task_id: taskId,
  });
  if (error) throw error;
}

export async function setSharedTaskPosition(
  sharedListId: string,
  taskId: string,
  position: number
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  // v3 改用 SECURITY DEFINER RPC（migration 0020）繞過 st_write RLS
  const { error } = await supabase.rpc("set_shared_task_position_v2", {
    p_sid: sharedListId,
    p_task_id: taskId,
    p_position: position,
  });
  if (error) throw error;
}

export async function getOrderedSharedTasks(sharedListId: string): Promise<Task[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("shared_tasks")
    .select("data,position")
    .eq("shared_list_id", sharedListId)
    .order("position", { ascending: true });
  if (error || !data) return [];
  return (data as any[])
    .sort((a, b) => a.position - b.position)
    .map((r) => r.data as Task);
}

// ── Realtime 訂閱：snapshot ───────────────────────────────────
export type SharedSnapshotCallback = (snapshot: SharedSnapshot | null) => void;
export type SharedMembersCallback = (members: SharedMember[]) => void;

export async function fetchSharedSnapshot(
  sharedListId: string
): Promise<SharedSnapshot | null> {
  if (!supabase) return null;

  const [{ data: listRow, error: listErr }, { data: taskRows, error: taskErr }] =
    await Promise.all([
      supabase.from("shared_lists").select("*").eq("id", sharedListId).maybeSingle(),
      supabase
        .from("shared_tasks")
        .select("data,position")
        .eq("shared_list_id", sharedListId)
        .order("position", { ascending: true }),
    ]);

  if (listErr) {
    // eslint-disable-next-line no-console
    console.error("[SharedSync] fetchSharedSnapshot list error", listErr);
    return null;
  }
  if (taskErr) {
    // eslint-disable-next-line no-console
    console.error("[SharedSync] fetchSharedSnapshot tasks error", taskErr);
    return null;
  }
  if (!listRow) return null;

  const list: TaskList = {
    id: listRow.id,
    name: listRow.name,
    icon: listRow.icon || "📋",
    color: listRow.color || "#3B82F6",
    ownerId: listRow.owner_uid,
    createdAt: listRow.created_at,
    updatedAt: listRow.updated_at,
    order: 0,
  };
  const tasks: Task[] = (taskRows || []).map((r: any) => r.data as Task);
  return {
    list,
    tasks,
    ownerName: listRow.owner_name || "",
  };
}

export function subscribeToSharedList(
  sharedListId: string,
  cb: SharedSnapshotCallback
): () => void {
  if (!supabase) {
    // eslint-disable-next-line no-console
    console.warn("[SharedSync] supabase not configured; realtime disabled");
    cb(null);
    return () => {};
  }

  let latestList: any = null;
  let latestTasks: Map<string, Task> = new Map();

  const emit = () => {
    if (!latestList) return cb(null);
    cb({
      list: {
        id: latestList.id,
        name: latestList.name,
        icon: latestList.icon || "📋",
        color: latestList.color || "#3B82F6",
        ownerId: latestList.owner_uid,
        createdAt: latestList.created_at,
        updatedAt: latestList.updated_at,
        order: 0,
      },
      tasks: Array.from(latestTasks.values()),
      ownerName: latestList.owner_name || "",
    });
  };

  const channel = supabase
    .channel(`shared:${sharedListId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "shared_lists", filter: `id=eq.${sharedListId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          latestList = null;
          latestTasks = new Map();
          cb(null);
          return;
        }
        latestList = payload.new;
        emit();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "shared_tasks", filter: `shared_list_id=eq.${sharedListId}` },
      (payload) => {
        const ev = payload.eventType;
        const row: any = payload.new ?? payload.old;
        if (!row) return;
        const task = row.data as Task;
        if (ev === "DELETE") {
          latestTasks.delete(row.id);
        } else {
          latestTasks.set(row.id, task);
        }
        emit();
      }
    )
    .subscribe();

  // Prime
  fetchSharedSnapshot(sharedListId).then((snap) => {
    if (snap) {
      latestList = {
        id: snap.list.id,
        name: snap.list.name,
        icon: snap.list.icon,
        color: snap.list.color,
        owner_uid: snap.list.ownerId,
        owner_name: snap.ownerName,
        created_at: snap.list.createdAt,
        updated_at: snap.list.updatedAt,
      };
      latestTasks = new Map(snap.tasks.map((t) => [t.id, t]));
      emit();
    }
  });

  return () => {
    if (supabase) supabase.removeChannel(channel);
  };
}

/** 訂閱 members：給 owner 端用來觀察誰加入 / 被踢 */
export function subscribeToMembers(
  sharedListId: string,
  cb: SharedMembersCallback
): () => void {
  if (!supabase) {
    cb([]);
    return () => {};
  }
  const channel = supabase
    .channel(`members:${sharedListId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "shared_list_members",
        filter: `shared_list_id=eq.${sharedListId}`,
      },
      async () => {
        const members = await listMembers(sharedListId);
        cb(members);
      }
    )
    .subscribe();
  // Prime
  listMembers(sharedListId).then(cb);

  return () => {
    if (supabase) supabase.removeChannel(channel);
  };
}

// ── helpers ───────────────────────────────────────────────────
function mapMemberRow(row: any): SharedMember {
  return {
    id: row.id,
    sharedListId: row.shared_list_id,
    memberEmail: row.member_email,
    memberUid: row.member_uid,
    role: row.role,
    status: row.status,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  };
}

function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return obj.map((v) => stripUndefined(v)) as any;
  }
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return out as any;
  }
  return obj;
}

export { isSupabaseConfigured };
