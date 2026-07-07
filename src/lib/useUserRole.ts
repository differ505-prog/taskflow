"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { UserRole, ADMIN_EMAILS, ROLE_CONFIGS } from "./types";

const USER_ROLE_KEY = "taskflow_user_role";
const BETA_USERS_KEY = "taskflow_beta_users"; // 存储 beta 用户邮箱列表

interface UseUserRoleResult {
  role: UserRole;
  roleConfig: typeof ROLE_CONFIGS[UserRole];
  canUpload: boolean;
  maxFileSizeMB: number;
  isAdmin: boolean;
  isBeta: boolean;
  isFree: boolean;
  // 管理功能
  setRole: (role: UserRole) => void;
  addBetaUser: (email: string) => void;
  removeBetaUser: (email: string) => void;
  getBetaUsers: () => string[];
  isBetaUser: (email: string) => boolean;
}

/**
 * 判斷用戶角色
 * - admin: 邮箱在 ADMIN_EMAILS 列表中
 * - beta: 邮箱在 beta_users localStorage 中，或已被管理員手動開通
 * - free: 預設
 */
function determineRole(user: User | null): UserRole {
  if (!user?.email) return "free";

  const email = user.email.toLowerCase();

  // 1. 檢查是否為管理員
  if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
    return "admin";
  }

  // 2. 檢查是否為 Beta 用戶
  const betaUsers = getBetaUsersFromStorage();
  if (betaUsers.map((e) => e.toLowerCase()).includes(email)) {
    return "beta";
  }

  // 3. 預設為 free
  return "free";
}

function getBetaUsersFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(BETA_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveBetaUsersToStorage(emails: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BETA_USERS_KEY, JSON.stringify(emails));
  } catch {
    // Storage full or unavailable
  }
}

export function useUserRole(user: User | null): UseUserRoleResult {
  const [betaUsers, setBetaUsers] = useState<string[]>([]);

  // 初始化：從 localStorage 載入 beta 用戶列表
  useEffect(() => {
    setBetaUsers(getBetaUsersFromStorage());
  }, []);

  // 計算當前角色
  const role = useMemo(() => {
    if (!user?.email) return "free";

    const email = user.email.toLowerCase();

    // admin 優先
    if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
      return "admin";
    }

    // beta 次之
    if (betaUsers.map((e) => e.toLowerCase()).includes(email)) {
      return "beta";
    }

    return "free";
  }, [user, betaUsers]);

  const roleConfig = ROLE_CONFIGS[role];

  const canUpload = roleConfig.canUpload;
  const maxFileSizeMB = roleConfig.maxFileSizeMB;
  const isAdmin = role === "admin";
  const isBeta = role === "beta";
  const isFree = role === "free";

  // 手動設定用戶角色（主要用於 admin 為他人開通 beta）
  const setRole = useCallback(
    (newRole: UserRole) => {
      if (!user?.email) return;

      if (newRole === "beta") {
        addBetaUser(user.email);
      } else if (newRole === "free") {
        removeBetaUser(user.email);
      }
      // admin 角色由 ADMIN_EMAILS 自動判定，localStorage 無法覆寫
    },
    [user]
  );

  const addBetaUser = useCallback((email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return;

    setBetaUsers((prev) => {
      if (prev.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
        return prev;
      }
      const next = [...prev, normalizedEmail];
      saveBetaUsersToStorage(next);
      return next;
    });
  }, []);

  const removeBetaUser = useCallback((email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    setBetaUsers((prev) => {
      const next = prev.filter((e) => e.toLowerCase() !== normalizedEmail);
      saveBetaUsersToStorage(next);
      return next;
    });
  }, []);

  const getBetaUsers = useCallback(() => betaUsers, [betaUsers]);

  const isBetaUser = useCallback(
    (email: string) => {
      return betaUsers.map((e) => e.toLowerCase()).includes(email.toLowerCase());
    },
    [betaUsers]
  );

  return {
    role,
    roleConfig,
    canUpload,
    maxFileSizeMB,
    isAdmin,
    isBeta,
    isFree,
    setRole,
    addBetaUser,
    removeBetaUser,
    getBetaUsers,
    isBetaUser,
  };
}

/**
 * 純函數：用於非 React 環境的權限檢查
 */
export function checkUploadPermission(
  userEmail: string | null | undefined,
  betaUsers: string[]
): { canUpload: boolean; maxFileSizeMB: number; role: UserRole } {
  if (!userEmail) {
    return { canUpload: false, maxFileSizeMB: 0, role: "free" };
  }

  const email = userEmail.toLowerCase();

  if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
    return { canUpload: true, maxFileSizeMB: Infinity, role: "admin" };
  }

  if (betaUsers.map((e) => e.toLowerCase()).includes(email)) {
    return { canUpload: true, maxFileSizeMB: 5, role: "beta" };
  }

  return { canUpload: false, maxFileSizeMB: 0, role: "free" };
}

/**
 * 格式化檔案大小顯示
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (!isFinite(bytes)) return "無限制";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}
