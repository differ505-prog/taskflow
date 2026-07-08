/**
 * GET /api/auth/diag
 * 專屬 Firebase Admin SDK 環境變數健康檢查。
 *
 * 為什麼要這個端點：
 *   /api/auth/session 在 idToken 缺失時會走 400 短路，看不到真實的 Admin SDK 初始化錯誤。
 *   這個端點不收任何參數，直接嘗試初始化 Admin SDK，回傳最詳細的環境變數狀態。
 *
 * 安全：完全不洩漏金鑰內容，只回傳「是否存在 / 格式是否正確 / 長度」。
 */
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";

  // 1) 環境變數檢查
  const envCheck = {
    FIREBASE_PROJECT_ID: {
      present: !!projectId,
      length: projectId.length,
      looksValid: /^[a-z0-9-]+$/.test(projectId),
    },
    FIREBASE_CLIENT_EMAIL: {
      present: !!clientEmail,
      length: clientEmail.length,
      looksValid: clientEmail.endsWith("@") ? false : clientEmail.includes("@"),
      isServiceAccount: clientEmail.includes("iam.gserviceaccount.com"),
    },
    FIREBASE_PRIVATE_KEY: {
      present: !!rawKey.length,
      length: rawKey.length,
      hasRealNewlines: rawKey.includes("\n"),
      hasEscapedNewlines: rawKey.includes("\\n"),
      startsWithPemHeader: rawKey.startsWith("-----BEGIN"),
      endsWithPemFooter: rawKey.trim().endsWith("-----END PRIVATE KEY-----"),
    },
  };

  // 2) Admin SDK 初始化檢查
  let adminCheck: { ok: boolean; error: string | null; stack?: string };
  try {
    getFirebaseAdminAuth();
    adminCheck = { ok: true, error: null };
  } catch (e: any) {
    adminCheck = {
      ok: false,
      error: String(e?.message || e),
      stack: e?.stack?.split("\n").slice(0, 3).join("\n"),
    };
  }

  // 3) 推測常見錯誤的根因
  const hints: string[] = [];
  if (!envCheck.FIREBASE_PROJECT_ID.present) hints.push("❌ FIREBASE_PROJECT_ID 完全沒設");
  if (!envCheck.FIREBASE_CLIENT_EMAIL.present) hints.push("❌ FIREBASE_CLIENT_EMAIL 完全沒設");
  if (!envCheck.FIREBASE_PRIVATE_KEY.present) hints.push("❌ FIREBASE_PRIVATE_KEY 完全沒設");
  if (
    envCheck.FIREBASE_PRIVATE_KEY.present &&
    !envCheck.FIREBASE_PRIVATE_KEY.hasRealNewlines &&
    !envCheck.FIREBASE_PRIVATE_KEY.hasEscapedNewlines
  ) {
    hints.push("⚠️ FIREBASE_PRIVATE_KEY 沒有換行字元，看起來不像 PEM 格式");
  }
  if (
    envCheck.FIREBASE_PRIVATE_KEY.present &&
    envCheck.FIREBASE_PRIVATE_KEY.hasRealNewlines &&
    envCheck.FIREBASE_PRIVATE_KEY.hasEscapedNewlines
  ) {
    hints.push("⚠️ FIREBASE_PRIVATE_KEY 同時含有真實 \\n 與字面 \\n，混亂了。建議存字面 \\n 並讓程式 replace");
  }
  if (
    envCheck.FIREBASE_PRIVATE_KEY.present &&
    !envCheck.FIREBASE_PRIVATE_KEY.startsWithPemHeader
  ) {
    hints.push("⚠️ FIREBASE_PRIVATE_KEY 開頭不是 -----BEGIN，前綴可能被截斷");
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    envCheck,
    adminCheck,
    hints,
    timestamp: new Date().toISOString(),
  });
}