/**
 * GET /api/auth/diag
 * Supabase 環境變數健康檢查。
 *
 * 安全：完全不洩漏完整 key 內容，只回傳「是否存在 / 長度」。
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // 環境變數檢查
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: {
      present: !!supabaseUrl,
      looksValid: supabaseUrl.startsWith("https://"),
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      present: !!anonKey.length,
      length: anonKey.length,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      present: !!serviceRoleKey.length,
      length: serviceRoleKey.length,
    },
  };

  // Supabase client 初始化檢查
  let clientCheck: { ok: boolean; error: string | null };
  try {
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { getAll: () => [], setAll: () => {} },
      }
    );
    clientCheck = { ok: true, error: null };
  } catch (e: any) {
    clientCheck = { ok: false, error: String(e?.message || e) };
  }

  // 推測根因提示
  const hints: string[] = [];
  if (!envCheck.NEXT_PUBLIC_SUPABASE_URL.present)
    hints.push("❌ NEXT_PUBLIC_SUPABASE_URL 未設定");
  if (!envCheck.NEXT_PUBLIC_SUPABASE_ANON_KEY.present)
    hints.push("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 未設定");

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    envCheck,
    clientCheck,
    hints,
    timestamp: new Date().toISOString(),
  });
}
