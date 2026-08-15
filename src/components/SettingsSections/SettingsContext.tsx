/**
 * SettingsContext — SettingsPage 各 section 的共享 UI 狀態集中管理
 *
 * 設計動機：SettingsPage 有 5 個 section 但 state 全擠在頂層，
 * 每次抽取 section 都要把對應 state/handlers 一起遷移，阻礙重構。
 * 有了 Context 後，各 section 可完全獨立抽取，只從 context 取需要的值。
 *
 * 範圍：本 context 只管「SettingsPage 內的 UI 局部狀態」，
 * 不含「App 層級共享狀態（如 theme、tasks、user 等）」—
 * 那些透過 useApp / useAuth 直接取用，不走本 context。
 *
 * 使用約定：
 * - 各 section 在 mount 時自己 init（如讀取 localStorage、呼叫 API）
 * - 不在 context 裡埋長生命週期的 effect（如偵測 push 狀態），由各 section 自己管理
 *
 * ⚠️ 注意：Context 不可用於 SSR/Hydration 不確定的場景。
 * SettingsPage 只在 client side render，無此問題。
 */
"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { translatePushError } from "@/lib/errorMessages";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/vapid";
import { logger } from "@/lib/logger";
import { getConfettiEnabled } from "@/lib/confetti";

/* ─────────────────────────────────────────────────────────────
   Context value type
   ───────────────────────────────────────────────────────────── */

export interface SettingsContextValue {
  // ── Push ─────────────────────────────────────────────────
  pushTestPending: boolean;
  setPushTestPending: (v: boolean) => void;
  pushBusy: boolean;
  setPushBusy: (v: boolean) => void;
  pushDbSubscribed: boolean | null;
  setPushDbSubscribed: (v: boolean | null) => void;
  pushSafariHint: string | null;
  setPushSafariHint: (v: string | null) => void;
  isPwa: boolean;
  handleResubscribePush: () => Promise<void>;
  handleUnsubscribePush: () => Promise<void>;
  handleForceResetPush: () => Promise<void>;
  handleTestPush: () => Promise<void>;

  // ── Calendar ──────────────────────────────────────────────
  newCalendarUrl: string;
  setNewCalendarUrl: (v: string) => void;
  webcalUrlCopied: boolean;
  setWebcalUrlCopied: (v: boolean) => void;

  // ── Webhook ───────────────────────────────────────────────
  webhookDraft: string;
  setWebhookDraft: (v: string) => void;
  webhookTestMsg: string | null;
  setWebhookTestMsg: (v: string | null) => void;
  webhookSaved: boolean;
  setWebhookSaved: (v: boolean) => void;

  // ── Theme ─────────────────────────────────────────────────
  theme: "light" | "dark" | "system";
  setTheme: (v: "light" | "dark" | "system") => void;

  // ── Data (import/export) ──────────────────────────────────
  exportMsg: string | null;
  setExportMsg: (v: string | null) => void;
  importMsg: string | null;
  setImportMsg: (v: string | null) => void;
  importErrors: string[];
  setImportErrors: (v: string[]) => void;
  importStats: { tasks: number; habits: number; lists: number } | null;
  setImportStats: (v: { tasks: number; habits: number; lists: number } | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // ── Confetti ───────────────────────────────────────────────
  confettiEnabled: boolean;
  setConfettiEnabledState: (v: boolean) => void;
}

/* ─────────────────────────────────────────────────────────────
   Context creation
   ───────────────────────────────────────────────────────────── */

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within <SettingsContext.Provider>");
  return ctx;
}

/* ─────────────────────────────────────────────────────────────
   Provider component
   ───────────────────────────────────────────────────────────── */

interface SettingsProviderProps {
  children: ReactNode;
  /** 傳入 SettingsPage 的 isOpen prop，讓 provider 知道何時 init */
  isOpen: boolean;
  /** 從 useApp 取 notificationPermission/setNotificationPermission */
  notificationPermission: NotificationPermission | "default";
  setNotificationPermission: (v: NotificationPermission | "default") => void;
  /** 從 useAuth 取 user.id */
  userId: string | null;
}

export function SettingsProvider({
  children,
  isOpen,
  notificationPermission,
  setNotificationPermission,
  userId,
}: SettingsProviderProps) {
  // ── Push ─────────────────────────────────────────────────
  const [pushTestPending, setPushTestPending] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushDbSubscribed, setPushDbSubscribed] = useState<boolean | null>(null);
  const [pushSafariHint, setPushSafariHint] = useState<string | null>(null);
  const [isPwa] = useState(
    typeof window !== "undefined"
      ? window.matchMedia?.("(display-mode: standalone)").matches
      : false,
  );
  const pushBusyRef = useRef(false);

  // ── Calendar ──────────────────────────────────────────────
  const [newCalendarUrl, setNewCalendarUrl] = useState("");
  const [webcalUrlCopied, setWebcalUrlCopied] = useState(false);

  // ── Webhook ───────────────────────────────────────────────
  const [webhookDraft, setWebhookDraft] = useState("");
  const [webhookTestMsg, setWebhookTestMsg] = useState<string | null>(null);
  const [webhookSaved, setWebhookSaved] = useState(false);

  // ── Theme ─────────────────────────────────────────────────
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");

  // ── Data ─────────────────────────────────────────────────
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importStats, setImportStats] = useState<{ tasks: number; habits: number; lists: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Confetti ───────────────────────────────────────────────
  const [confettiEnabled, setConfettiEnabledState] = useState(true);

  // ── Theme init ────────────────────────────────────────────
  useEffect(() => {
    setConfettiEnabledState(getConfettiEnabled());
    const saved = localStorage.getItem("taskflow_theme") as "light" | "dark" | "system" | null;
    if (saved) setTheme(saved);
  }, [setTheme]);

  /* ── Push handlers ────────────────────────────────────────── */

  const detectPushDbState = useCallback(async () => {
    if (!userId) return;
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("endpoint")
        .eq("owner_uid", userId)
        .eq("is_active", true)
        .limit(1);
      if (error) {
        logger.ns("SettingsPage").warn("detect DB state failed", { error });
        return;
      }
      setPushDbSubscribed((data?.length ?? 0) > 0);
    } catch (e) {
      logger.ns("SettingsPage").warn("detect DB state threw", { error: e });
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) void detectPushDbState();
  }, [isOpen, userId, detectPushDbState]);

  const handleResubscribePush = useCallback(async () => {
    if (pushBusyRef.current) return;
    pushBusyRef.current = true;
    setPushBusy(true);
    const rescue = () => {
      pushBusyRef.current = false;
      setPushBusy(false);
    };
    const timeout = setTimeout(rescue, 15000);
    try {
      const sub = await Promise.race([
        subscribeToPush(),
        new Promise<PushSubscription | null>((resolve) => setTimeout(() => resolve(null), 12000)),
      ]);
      if (!sub) {
        if (typeof Notification === "undefined") {
          toast.error("此瀏覽器不支援推播");
        } else if (Notification.permission === "denied") {
          toast.error("推播被拒絕,到 iOS 設定 → Safari 開啟");
        } else if (Notification.permission === "default") {
          toast.error("通知權限視窗被略過,請用 Safari 一般 tab 開站一次並允許");
        } else {
          toast.error("訂閱逾時,請再試一次");
        }
        return;
      }
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const ua = navigator.userAgent;
      const deviceLabel = /iPhone|iPad/.test(ua)
        ? "iOS Safari"
        : /Android/.test(ua)
          ? "Android Chrome"
          : /Mac/.test(ua)
            ? "Mac"
            : /Windows/.test(ua)
              ? "Windows"
              : "Unknown";
      const res = await Promise.race([
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
            deviceLabel,
          }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("API 連線逾時 12 秒")), 12000),
        ),
      ]);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`訂閱寫入失敗：${err.error ?? res.status}`);
        return;
      }
      toast.success("推播已重新訂閱");
      setPushDbSubscribed(true);
    } catch (e) {
      toast.error(translatePushError(e, "subscribe"));
    } finally {
      clearTimeout(timeout);
      rescue();
    }
  }, []);

  const handleUnsubscribePush = useCallback(async () => {
    if (pushBusyRef.current) return;
    pushBusyRef.current = true;
    setPushBusy(true);
    const rescue = () => {
      pushBusyRef.current = false;
      setPushBusy(false);
    };
    const timeout = setTimeout(rescue, 12000);
    try {
      await unsubscribeFromPush();
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) {
        toast.info("瀏覽器端沒有訂閱");
        setPushDbSubscribed(false);
        return;
      }
      const endpoint = sub.endpoint;
      await unsubscribeFromPush();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
      toast.success("已取消推播訂閱");
      setPushDbSubscribed(false);
    } catch (e) {
      toast.error(translatePushError(e, "unsubscribe"));
    } finally {
      clearTimeout(timeout);
      rescue();
    }
  }, []);

  const handleForceResetPush = useCallback(async () => {
    if (pushBusyRef.current) return;
    pushBusyRef.current = true;
    setPushBusy(true);
    const rescue = () => {
      pushBusyRef.current = false;
      setPushBusy(false);
    };
    const timeout = setTimeout(rescue, 15000);
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try {
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        } catch { /* individual unsubscribe failure ignored */ }
        try {
          await reg.unregister();
        } catch { /* unregister failure ignored */ }
      }
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js");
        } catch { /* re-register failure ignored */ }
      }
      if (userId) {
        const { supabase } = await import("@/lib/supabase");
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("owner_uid", userId)
          .eq("is_active", true);
      }
      toast.success("推播已強制重置，請重新啟用推播");
      setPushDbSubscribed(false);
      setNotificationPermission("default");
    } catch (e) {
      toast.error(translatePushError(e, "reset"));
    } finally {
      clearTimeout(timeout);
      rescue();
    }
  }, [userId, setNotificationPermission]);

  const handleTestPush = useCallback(async () => {
    if (pushTestPending) return;
    setPushTestPending(true);
    try {
      const res = await fetch("/api/push/test-self", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`測試失敗：${data?.error ?? res.status}`);
        return;
      }
      if (data.sent > 0) {
        toast.success(`推播已送出 ${data.sent} 則`);
      } else if (data.expired > 0) {
        toast.warning("訂閱已過期，請重新授權通知");
      } else {
        toast.error("沒有可送達的訂閱，請確認已授權通知權限");
      }
    } catch (e) {
      toast.error(translatePushError(e, "test"));
    } finally {
      setPushTestPending(false);
    }
  }, [pushTestPending]);

  /* ── Compose context value ────────────────────────────────── */

  const value: SettingsContextValue = {
    // Push
    pushTestPending, setPushTestPending,
    pushBusy, setPushBusy,
    pushDbSubscribed, setPushDbSubscribed,
    pushSafariHint, setPushSafariHint,
    isPwa,
    handleResubscribePush,
    handleUnsubscribePush,
    handleForceResetPush,
    handleTestPush,
    // Calendar
    newCalendarUrl, setNewCalendarUrl,
    webcalUrlCopied, setWebcalUrlCopied,
    // Webhook
    webhookDraft, setWebhookDraft,
    webhookTestMsg, setWebhookTestMsg,
    webhookSaved, setWebhookSaved,
    // Theme
    theme, setTheme,
    // Data
    exportMsg, setExportMsg,
    importMsg, setImportMsg,
    importErrors, setImportErrors,
    importStats, setImportStats,
    fileInputRef,
    // Confetti
    confettiEnabled, setConfettiEnabledState,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
