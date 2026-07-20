"use client";

/**
 * useNewUserDetection — 偵測是否為新用戶註冊
 *
 * 策略：使用 localStorage 記錄已知用戶 UID
 * - 瀏覽器首次看到某 UID → 新用戶
 * - 同一瀏覽器再次看到同一 UID → 舊用戶登入
 *
 * 限制：僅限單瀏覽器有效（跨設備無法偵測）
 * 替代方案：Supabase DB trigger 寫入 users.is_new 欄位（需後端）
 *
 * 用法：
 *   const { isNewUser, markAsKnown } = useNewUserDetection(user?.uid);
 *   useEffect(() => {
 *     if (isNewUser && user?.email) {
 *       notifyNewUser(user.email);
 *       markAsKnown();
 *     }
 *   }, [isNewUser]);
 */
import { useEffect, useState } from "react";

const KNOWN_USERS_KEY = "taskflow_known_users";

function getKnownUsers(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KNOWN_USERS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markUserKnown(uid: string): void {
  if (typeof window === "undefined") return;
  const known = getKnownUsers();
  known.add(uid);
  localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify([...known]));
}

/**
 * 取得目前已知用戶數量（估算總用戶數，用於 Discord 通知門檻）
 */
export function getKnownUserCount(): number {
  return getKnownUsers().size;
}

/**
 * Hook：偵測是否為新用戶
 */
export function useNewUserDetection(uid: string | undefined) {
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!uid) {
      setIsNewUser(false);
      return;
    }

    const known = getKnownUsers();
    if (!known.has(uid)) {
      setIsNewUser(true);
    } else {
      setIsNewUser(false);
    }
  }, [uid]);

  const markAsKnown = () => {
    if (!uid) return;
    markUserKnown(uid);
    setIsNewUser(false);
  };

  return { isNewUser, markAsKnown };
}
