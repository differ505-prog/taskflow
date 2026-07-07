import { supabase, isSupabaseConfigured } from "./supabase";
import type { Task, TaskList } from "./types";

/**
 * Shared-list realtime sync layer (Supabase) — v2.
 *
 * Design:
 *  - Postgres rows are the source of truth.
 *  - `shared_lists`         : 清單 metadata
 *  - `shared_list_members`  : 成員（含 role / status / 邀請時間）
 *  - `shared_tasks`         : 每個任務獨立 row + position (排序欄位)
 *
 * 安全機制：
 *  - 客戶端拿 Firebase ID token 注入 Supabase REST + Realtime
 *  - RLS 用 `can_read_list` / `can_write_list` 兩條 function 決定誰能看 / 寫
 *  - 接受邀請時，client 端必須帶上 firebase user.email；
 *    並在 binding 前比對該 email 是否存在於 invited member list 中。
 *    (詳見 bindCurrentUserToInvite)
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
export async function ensureSharedList(args: {
  sharedListId: string;
  ownerUid: string;
  ownerEmail: string | null;
  ownerName: string;
  list: TaskList;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { sharedListId, ownerUid, ownerEmail, ownerName, list } = args;

  const { error: listErr } = await supabase.from("shared_lists").upsert(
    {
      id: sharedListId,
      owner_uid: ownerUid,
      name: list.name,
      icon: list.icon || "📋",
      color: list.color || "#3B82F6",
      owner_email: ownerEmail,
      owner_name: ownerName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (listErr) throw listErr;

  // 把 owner 自己寫進 members（idempotent，用 email/uid 為對 key）。
  // 注意：在 RLS 下 anon 寫入 owner row 會需要 service-role 或放寬政策，
  // 因此這條也必須在 supabase 端用 service-role key。
  // 為簡化，這裡假設 migration 已開 policy：
  //   create policy slm_owner_all on public.shared_list_members ...
  // 並允許 anon 把「自己 uid 對應到的 row」insert。詳見 supabase/migrations/0001_shared_lists_v2.sql。
  const { error: memErr } = await supabase.from("shared_list_members").upsert(
    {
      shared_list_id: sharedListId,
      member_uid: ownerUid,
      member_email: (ownerEmail || "").toLowerCase(),
      role: "owner",
      status: "active",
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "shared_list_id,member_email" }
  );
  if (memErr) throw memErr;
}

// ── Owner: 邀請成員 ───────────────────────────────────────────
export async function inviteMember(args: {
  sharedListId: string;
  memberEmail: string;
  role: MemberRole;
}): Promise<SharedMember> {
  if (!supabase) throw new Error("Supabase not configured");
  const email = args.memberEmail.toLowerCase();

  // upsert：以 (list_id, email) 為唯一；若已存在就更新 role
  const { data, error } = await supabase
    .from("shared_list_members")
    .upsert(
      {
        shared_list_id: args.sharedListId,
        member_email: email,
        role: args.role,
        status: "pending",
        invited_at: new Date().toISOString(),
      },
      { onConflict: "shared_list_id,member_email" }
    )
    .select()
    .single();
  if (error) throw error;
  return mapMemberRow(data);
}

// ── Recipient: 接受邀請（必須 email 自報且符合 pending row）───
// 注意：補釘 #3 — 在寫入時必須再次比對目前登入使用者的 email 是否真為「被邀請者」。
// 我們用 caller-supplied 兩個欄位完成這層檢查：
//   1) callerUid      = auth.currentUser.uid
//   2) callerEmail    = auth.currentUser.email (lowercase)
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
export async function removeMember(args: {
  sharedListId: string;
  memberEmail: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("shared_list_members")
    .update({ status: "removed" })
    .eq("shared_list_id", args.sharedListId)
    .eq("member_email", args.memberEmail.toLowerCase());
  if (error) throw error;
}

// ── Owner: 降級成員角色 ─────────────────────────────────────────
export async function changeMemberRole(args: {
  sharedListId: string;
  memberEmail: string;
  role: MemberRole;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("shared_list_members")
    .update({ role: args.role })
    .eq("shared_list_id", args.sharedListId)
    .eq("member_email", args.memberEmail.toLowerCase());
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
export async function upsertSharedTasks(
  sharedListId: string,
  tasks: Task[]
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  if (tasks.length === 0) return;

  // 讀現有 positions 做 nudge，避免撞 key
  const { data: posRows } = await supabase
    .from("shared_tasks")
    .select("id,position")
    .eq("shared_list_id", sharedListId);

  const posMap = new Map<string, number>();
  (posRows || []).forEach((r: any) => posMap.set(r.id, r.position as number));

  let cursor = await nextTaskPosition(sharedListId);
  const rows = tasks.map((t) => {
    // 如果 task 已經存在，沿用它的 position；新任務給新的 cursor
    let position = posMap.get(t.id);
    if (position === undefined) {
      position = cursor;
      cursor += 1024;
    }
    return {
      id: t.id,
      shared_list_id: sharedListId,
      data: stripUndefined(t),
      position,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("shared_tasks")
    .upsert(rows, { onConflict: "shared_list_id,id" });
  if (error) throw error;
}

export async function deleteSharedTask(
  sharedListId: string,
  taskId: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("shared_tasks")
    .delete()
    .eq("shared_list_id", sharedListId)
    .eq("id", taskId);
  if (error) throw error;
}

export async function setSharedTaskPosition(
  sharedListId: string,
  taskId: string,
  position: number
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("shared_tasks")
    .update({ position, updated_at: new Date().toISOString() })
    .eq("shared_list_id", sharedListId)
    .eq("id", taskId);
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
