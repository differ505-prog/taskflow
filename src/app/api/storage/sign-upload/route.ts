/**
 * /api/storage/sign-upload — Supabase Storage 簽名上傳 URL 核發 API
 *
 * 設計動機（§8 資安硬化）：
 *   client 不能直接上傳到 public Supabase endpoint，否則：
 *     1. 任何人可列舉 bucket 內容
 *     2. 無法控制檔案類型 / 大小
 *     3. Rate limit 無法作用
 *
 * 解法：client 先請求本 API，拿 signed upload URL，再依該 URL 上傳。
 *       路徑完全由 server 生成，client 無法指定。
 *
 * Request：
 *   POST /api/storage/sign-upload
 *   { "filename": "report.pdf", "mimeType": "application/pdf", "size": 204800 }
 *
 * Response：
 *   成功：{ "success": true, "token": "...", "path": "...", "publicUrl": "..." }
 *   失敗：{ "error": "..." } + 對應 HTTP status
 *
 * Rate limit：每 user 每小時 30 次（in-memory Map，key = user.id）
 * 上傳限制：10MB，僅允許 image/*, application/pdf, text/plain, text/csv
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

// ─── 白名單 MIME 類型 ───
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
  "text/csv",
]);

// ─── Zod Input Schema ───────────────────────────────────────────────────────
const UploadRequestInput = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string(),
  size: z.number().positive(),
});

// ─── 大小限制（預設值，實際上限依 role 動態調整）───
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILENAME_LENGTH = 200;

function getSafeFilename(originalName: string): string {
  // 移除路徑Traversal風險字元，取最後一個路徑段
  const name = originalName.split("/").pop()!.split("\\").pop()!;
  // 只保留合法檔名字元，長度截斷
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, MAX_FILENAME_LENGTH);
}

function generateStoragePath(userId: string, safeFilename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${userId}/${timestamp}_${random}_${safeFilename}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. 建立 Supabase 客戶端驗證 session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey ?? "", {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limit (user-based, distributed via Supabase)
    const { allowed: uploadAllowed } = await checkRateLimit(`upload:${user.id}`, 30, 60 * 60 * 1000);
    if (!uploadAllowed) {
      return NextResponse.json(
        { error: "上傳頻率過高，請稍後再試" },
        { status: 429 }
      );
    }

    // 3. 驗證 user role（提前擋 free 用戶，省一次 Storage RTT）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("uid", user.id)
      .single();

    const role = profile?.role ?? "free";
    if (role === "free") {
      return NextResponse.json(
        { error: "請升級到 Beta 以使用附件上傳功能" },
        { status: 403 }
      );
    }

    // 依 role 動態調整 size 上限
    const MAX_BYTES_BY_ROLE: Record<string, number> = {
      admin: 50 * 1024 * 1024,  // 50MB
      pro:   20 * 1024 * 1024,  // 20MB
      beta:   5 * 1024 * 1024,  //  5MB
    };
    const effectiveMaxSize = MAX_BYTES_BY_ROLE[role] ?? 0;

    // 4. 解析並驗證 body（Zod schema，基礎欄位驗證）
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = UploadRequestInput.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const firstIssue = issues[0];
      let msg = "格式錯誤";
      if (firstIssue?.path[0] === "filename") msg = "filename 為必填欄位，且不可超過 200 字";
      if (firstIssue?.path[0] === "size") msg = "size 必須為正數";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { filename, mimeType, size } = parsed.data;

    // 4b. MIME type 白名單（在 Zod 基礎驗證後再做）
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "不支援的檔案類型" }, { status: 415 });
    }

    // 4c. 動態 size 上限（依 role，需在 body 解析後、generateStoragePath 前檢查）
    if (size > effectiveMaxSize) {
      const mb = Math.round(effectiveMaxSize / 1024 / 1024);
      return NextResponse.json(
        { error: `檔案大小超出限制（上限 ${mb}MB）` },
        { status: 413 }
      );
    }

    // 5. 生成安全路徑（server-side 掌控，client 無法指定）
    const safeFilename = getSafeFilename(filename);
    const storagePath = generateStoragePath(user.id, safeFilename);
    const bucket = "attachments";

    // 6. 使用 service_role_key 直接呼叫 Supabase Storage REST API 建立 signed upload URL
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const signedUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${storagePath}`;

    const signRes = await fetch(signedUrl, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    if (!signRes.ok) {
      console.error("[sign-upload] Failed to create signed URL:", await signRes.text());
      return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
    }

    const signData = (await signRes.json()) as { url?: string; token?: string };
    const uploadUrl = signData.url ?? `${signedUrl}?token=${signData.token ?? ""}`;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;

    return NextResponse.json({
      success: true,
      token: signData.token ?? "",
      path: storagePath,
      publicUrl,
      uploadUrl,
    });
  } catch (err) {
    console.error("[sign-upload] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
