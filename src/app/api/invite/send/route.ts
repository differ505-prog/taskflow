/**
 * /api/invite/send — 發送邀請 Email API
 *
 * 流程：
 *   1. 驗證當前登入者（需為清單 owner）
 *   2. 生成一次性 UUID token
 *   3. 寫入 shared_invites 表
 *   4. 寄送 email（使用 Resend）
 *
 * 請求：
 *   POST /api/invite/send
 *   {
 *     "sharedListId": "xxx",
 *     "inviteeEmail": "xxx@gmail.com",
 *     "role": "editor" | "viewer"
 *   }
 *
 * 環境變數：
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL
 *   NEXT_PUBLIC_APP_URL（如 https://vibelist.app）
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { renderInviteEmail } from "@/emails";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.vibelist.work";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "VibeList <noreply@vibelist.app>";

// ─── Lazy client factory ────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client not configured");
  }
  return createClient(url, key);
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. 解析 body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { sharedListId, inviteeEmail, role } = body;

    if (!sharedListId || !inviteeEmail || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["editor", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteeEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // ── 2. 驗證發送者身份 ────────────────────────────────────────────────────
    let senderUid: string;
    let senderEmail: string;
    try {
      const authHeader = req.headers.get("Authorization");
      const tokenStr = authHeader ? authHeader.replace("Bearer ", "").trim() : "none";
      const tokenPrefix = tokenStr.substring(0, 15);
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: authHeader || "" } },
          cookies: {
            getAll() { return req.cookies.getAll(); },
            setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value)); },
          },
        }
      );
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: `Invalid token (${tokenPrefix}...): ${error?.message || 'unknown'}` }, { status: 401 });
      }
      senderUid = user.id;
      senderEmail = user.email ?? "";
    } catch (err: any) {
      console.error("Auth verification failed:", err);
      return NextResponse.json({ error: `Auth verification failed: ${err?.message || 'unknown'}` }, { status: 401 });
    }

    // ── 3. 確認發送者是清單 owner ────────────────────────────────────────────
    const admin = getSupabaseAdmin();
    const { data: list, error: listError } = await admin
      .from("shared_lists")
      .select("id, owner_uid, owner_name, name, icon")
      .eq("id", sharedListId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "Shared list not found" }, { status: 404 });
    }

    if (list.owner_uid !== senderUid) {
      return NextResponse.json({ error: "Only owner can send invites" }, { status: 403 });
    }

    // ── 4. 檢查是否已有有效邀請 ──────────────────────────────────────────────
    const { data: existingInvite } = await admin
      .from("shared_invites")
      .select("id, token")
      .eq("shared_list_id", sharedListId)
      .eq("invitee_email", inviteeEmail.toLowerCase())
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    let token: string;
    if (existingInvite && existingInvite.length > 0) {
      token = existingInvite[0].token;
    } else {
      // ── 5. 生成 token 並寫入 ────────────────────────────────────────────────
      token = crypto.randomUUID();
      const { error: insertError } = await admin
        .from("shared_invites")
        .insert({
          token,
          shared_list_id: sharedListId,
          invitee_email: inviteeEmail.toLowerCase(),
          inviter_uid: senderUid,
          inviter_name: list.owner_name ?? senderEmail.split("@")[0],
          role,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (insertError) {
        console.error("[invite/send] Insert failed:", insertError);
        return NextResponse.json(
          { error: "Failed to create invite", detail: insertError.message, code: insertError.code },
          { status: 500 }
        );
      }
    }

    // ── 6. 寄送 email ────────────────────────────────────────────────────────
    const resend = getResend();
    if (!resend) {
      console.warn("[invite/send] RESEND_API_KEY not configured, skipping email");
      return NextResponse.json({ success: true, token, emailSkipped: true }, { status: 200 });
    }

    const inviteLink = `${APP_URL}/invite/${token}`;
    const inviterName = list.owner_name ?? senderEmail.split("@")[0];

    const { html, text } = renderInviteEmail({
      inviterName,
      listName: list.name,
      listIcon: list.icon ?? "📋",
      inviteLink,
      role,
    });

    const { error: emailError } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: inviteeEmail,
      subject: `${inviterName} 邀請你加入「${list.name}」`,
      html,
      text,
    });

    if (emailError) {
      console.error("[invite/send] Email send failed:", emailError);
      // 發信失敗（可能是尚未驗證網域或測試帳號限制），退回到「複製連結」模式
      return NextResponse.json({ success: true, token, emailSkipped: true }, { status: 200 });
    }

    return NextResponse.json({ success: true, token }, { status: 200 });

  } catch (err) {
    console.error("[invite/send] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
