import { ADMIN_EMAILS, PRO_EMAILS, type UserRole } from "@/lib/types";

export interface ResolveRoleInput {
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  dbRole?: UserRole | string | null;
  betaEmails?: readonly string[];
  isBetaEmail?: boolean;
  adminEmails?: readonly string[];
  proEmails?: readonly string[];
}

function normalizeEmailList(list: readonly string[]): string[] {
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * 單一真理（SSOT）：統一 client（AuthContext）與 server API（sign-upload / feedback）的身分角色判斷。
 * 優先級：
 *   admin（env / metadata / db）> pro（env / metadata / db）> beta（名單 / db）> free
 */
export function resolveUserRole(input: ResolveRoleInput): UserRole {
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!email) return "free";

  const adminList = normalizeEmailList(input.adminEmails ?? ADMIN_EMAILS);
  const proList = normalizeEmailList(input.proEmails ?? PRO_EMAILS);
  const meta = input.metadata ?? {};
  const isAdminMeta = meta.is_admin === true || meta.is_admin === "true";
  const isProMeta = meta.is_pro === true || meta.is_pro === "true";

  if (adminList.includes(email)) return "admin";
  if (isAdminMeta) return "admin";
  if (input.dbRole === "admin") return "admin";

  if (proList.includes(email)) return "pro";
  if (isProMeta) return "pro";
  if (input.dbRole === "pro") return "pro";

  const inBetaList =
    Boolean(input.isBetaEmail) ||
    (input.betaEmails ? normalizeEmailList(input.betaEmails).includes(email) : false);
  if (inBetaList) return "beta";
  if (input.dbRole === "beta") return "beta";

  return "free";
}
