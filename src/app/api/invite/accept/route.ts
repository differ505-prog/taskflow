/**
 * /api/invite/accept — 接受邀請 API
 *
 * 流程：
 *   1. 驗證當前登入者
 *   2. 用 token 查詢 shared_invites（需有 service_role 權限）
 *   3. 檢查 token 未使用、未過期、email 對應
 *   4. 在 shared_list_members 寫入新成員
 *   5. 標記 invite 為已使用
 *
 * 請求：
 *   POST /api/invite/accept
 *   { "token": "uuid-string" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin not configured");
  return createClient(url, key);
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. 解析 body ──────────────────────────────────────────────────────
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // ── 2. 驗證當前登入者 ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userUid: string;
    let userEmail: string;
    try {
      const admin = getSupabaseAdmin();
      const { data: { user }, error } = await admin.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (error || !user) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      userUid = user.id;
      userEmail = (user.email ?? "").toLowerCase();
    } catch {
      return NextResponse.json({ error: "Auth verification failed" }, { status: 401 });
    }

    // ── 3. 用 service role 查詢 invite（繞過 RLS）───────────────────────
    const admin = getSupabaseAdmin();

    // 先查 invite 資料（包含 list name 等）
    const { data: invite, error: inviteError } = await admin
      .from("shared_invites")
      .select("*, shared_lists(name, icon)")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // ── 4. 驗證邀請狀態 ─────────────────────────────────────────────────
    if (invite.used_at) {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    // ── 5. 檢查 email 是否對應 ───────────────────────────────────────────
    if (invite.invitee_email.toLowerCase() !== userEmail) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }

    // ── 6. 檢查是否已經是成員 ───────────────────────────────────────────
    const { data: existingMember } = await admin
      .from("shared_list_members")
      .select("id")
      .eq("shared_list_id", invite.shared_list_id)
      .eq("member_email", userEmail)
      .eq("status", "active")
      .limit(1);

    if (existingMember && existingMember.length > 0) {
      return NextResponse.json(
        { error: "You are already a member of this list" },
        { status: 409 }
      );
    }

    // ── 7. 加入成員（同一 transaction 內）────────────────────────────────
    // 先刪除舊的 pending invite（如果有的話）
    await admin
      .from("shared_list_members")
      .delete()
      .eq("shared_list_id", invite.shared_list_id)
      .eq("member_email", userEmail)
      .eq("status", "pending");

    // 插入新成員
    const { error: memberError } = await admin
      .from("shared_list_members")
      .insert({
        shared_list_id: invite.shared_list_id,
        member_email: userEmail,
        member_uid: userUid,
        role: invite.role,
        status: "active",
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error("[invite/accept] Insert member failed:", memberError);
      return NextResponse.json({ error: "Failed to join list" }, { status: 500 });
    }

    // 標記 invite 已使用
    await admin
      .from("shared_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    return NextResponse.json({
      success: true,
      sharedListId: invite.shared_list_id,
      listName: (invite.shared_lists as any)?.name ?? "共用清單",
      listIcon: (invite.shared_lists as any)?.icon ?? "📋",
    });

  } catch (err) {
    console.error("[invite/accept] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
