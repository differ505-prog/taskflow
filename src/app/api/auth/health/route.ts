/**
 * GET /api/auth/health
 * 最最最簡單的健康檢查，不依賴任何模組。
 * 用來判斷是「Vercel 部署有問題」還是「Firebase Admin SDK 有問題」。
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelRegion: process.env.VERCEL_REGION,
    runtime: "edge-or-nodejs",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ set" : "❌ missing",
    fbPid: process.env.FIREBASE_PROJECT_ID ? "✅ set" : "❌ missing",
    fbEmail: process.env.FIREBASE_CLIENT_EMAIL ? "✅ set" : "❌ missing",
    fbKey: process.env.FIREBASE_PRIVATE_KEY ? `✅ set (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : "❌ missing",
  });
}