import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ADMIN_EMAILS, PRO_EMAILS, type UserRole } from "@/lib/types";
import { resolveUserRole } from "@/lib/resolveRole";

function getEnvEmailList(primary: readonly string[], fallbackEnv?: string): string[] {
  const extra = (fallbackEnv || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...primary, ...extra]));
}

/**
 * Server-side 權威角色查詢：與前端 AuthContext 採用完全相同的優先級（SSOT）。
 * 同時檢查環境變數（ADMIN_EMAILS / PRO_EMAILS）、auth metadata、user_profiles.role 與 beta_users 表。
 */
export async function resolveServerUserRole(
  supabaseAdmin: SupabaseClient,
  user: Pick<User, "id" | "email" | "user_metadata">
): Promise<UserRole> {
  const email = user.email?.trim().toLowerCase() ?? "";

  const [{ data: profile }, betaResult] = await Promise.all([
    supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("uid", user.id)
      .maybeSingle(),
    email
      ? supabaseAdmin
          .from("beta_users")
          .select("email")
          .eq("email", email)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return resolveUserRole({
    email: user.email,
    metadata: (user.user_metadata as Record<string, unknown>) ?? {},
    dbRole: (profile?.role as UserRole | undefined) ?? "free",
    isBetaEmail: Boolean(betaResult?.data?.email),
    adminEmails: getEnvEmailList(ADMIN_EMAILS, process.env.ADMIN_EMAILS),
    proEmails: getEnvEmailList(PRO_EMAILS, process.env.PRO_EMAILS),
  });
}
