const fs = require('fs');
let syncFile = fs.readFileSync('src/lib/sharedSync.ts', 'utf8');

const oldGetRole = `export async function getMyRole(args: {
  sharedListId: string;
  callerUid: string;
}): Promise<MemberRole | null> {
  if (!supabase) return null;

  // 先查 members table
  const { data: memberData } = await supabase
    .from("shared_list_members")
    .select("role")
    .eq("shared_list_id", args.sharedListId)
    .eq("member_uid", args.callerUid)
    .eq("status", "active")
    .maybeSingle();

  if (memberData) return memberData.role as MemberRole;

  // Fallback：用 owner_uid 直接判斷（繞過 member_uid 時序問題）
  const { data: listData } = await supabase
    .from("shared_lists")
    .select("owner_uid")
    .eq("id", args.sharedListId)
    .maybeSingle();

  if (listData?.owner_uid === args.callerUid) return "owner";

  return null;
}`;

const newGetRole = `export async function getMyRole(args: {
  sharedListId: string;
  callerUid: string;
}): Promise<MemberRole | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_my_role_v2", {
    p_sid: args.sharedListId,
  });

  if (error) {
    console.error("[getMyRole] error:", error);
    return null;
  }
  return data as MemberRole | null;
}`;

syncFile = syncFile.replace(oldGetRole, newGetRole);
fs.writeFileSync('src/lib/sharedSync.ts', syncFile);
console.log("Patched sharedSync.ts");
