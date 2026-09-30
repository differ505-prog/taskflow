/**
 * src/lib/assert-env.ts
 *
 * 部署時環境變數強制檢查（Production only）。
 * 在 Next.js instrumentation warm-up 階段觸發。
 * 若檢查失敗，throw → Vercel build / deploy 失敗（需修補後重新 deploy）。
 *
 * 只針對「若缺則整站功能直接壞掉」的關鍵變數，
 * 不是每個 .env.local 變數都檢查。
 */

/** 管理員診斷金鑰：>= 32 字元，防止暴力枚舉 */
function assertDiagSecret(): void {
  const s = process.env.DIAG_SECRET;
  if (!s) {
    throw new Error("[assert-env] DIAG_SECRET is not set. Required >= 32 chars.");
  }
  if (s.length < 32) {
    throw new Error(
      `[assert-env] DIAG_SECRET too short (${s.length} chars). Minimum 32 chars required.`
    );
  }
  if (s.includes(" ")) {
    throw new Error("[assert-env] DIAG_SECRET contains whitespace characters.");
  }
}

/** Cron Secret：用於 Vercel Cron job 認證 */
function assertCronSecret(): void {
  const s = process.env.CRON_SECRET;
  if (!s) {
    throw new Error("[assert-env] CRON_SECRET is not set in production.");
  }
  if (s.length < 32) {
    throw new Error(
      `[assert-env] CRON_SECRET too short (${s.length} chars). Minimum 32 chars required.`
    );
  }
}

/** 觸發所有檢查（只在 production 呼叫）*/
export function runEnvAssertions(): void {
  if (process.env.NODE_ENV !== "production") return;

  try {
    assertDiagSecret();
    assertCronSecret();
  } catch (err) {
    console.error("[assert-env] Production env validation failed:", err);
    throw err;
  }
}
