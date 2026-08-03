/**
 * /api/invite/info — 查詢邀請資訊（GET）
 *
 * 用於 /invite/[token] 頁面在加入前顯示清單名稱、邀請人等資訊。
 * 任何人都能讀取（invite token 是 UUID，無法猜測），
 * 但我們仍用 service_role 來繞過 RLS 確保可靠性。
 *
 * GET /api/invite/info?token=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin not configured");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: invite, error } = await admin
      .from("shared_invites")
      .select("*, shared_lists(name, icon)")
      .eq("token", token)
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.used_at) {
      return NextResponse.json({ error: "Invite already used" }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    return NextResponse.json({
      listName: (invite.shared_lists as any)?.name ?? "共用清單",
      listIcon: (invite.shared_lists as any)?.icon ?? "📋",
      inviterName: invite.inviter_name ?? "某人",
      role: invite.role,
      inviteeEmail: invite.invitee_email,
      expiresAt: invite.expires_at,
    });
  } catch (err) {
    console.error("[invite/info] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
