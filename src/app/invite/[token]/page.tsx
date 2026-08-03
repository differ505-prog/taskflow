"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Mail } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

type PageState = "loading" | "invalid_token" | "expired" | "wrong_email" | "already_member" | "authenticated" | "joining" | "success";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const { user, loading: authLoading } = useAuth();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [inviteInfo, setInviteInfo] = useState<{
    listName: string;
    listIcon: string;
    inviterName: string;
    role: string;
    inviteeEmail: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── 驗證 token 並取得邀請資訊 ────────────────────────────────────────────
  const verifyToken = useCallback(async () => {
    if (!token) return;

    try {
      // 用 service role 查詢（client side 用 fetch 到 accept API 之前先做一個 GET 端點，
      // 但目前只有 accept POST 端點，所以我們直接 try accept，
      // 讓後端區分「未登入」與「其他錯誤」）
      //
      // 更好的做法：加一個 GET /api/invite/info/:token 端點查邀請資訊，
      // 但這裡先用 client-side 試探：fetch GET /api/invite/info/:token
      // 如果失敗，再視為「未登入」
      const res = await fetch(`/api/invite/info?token=${encodeURIComponent(token)}`);

      if (res.status === 404) {
        setPageState("invalid_token");
        return;
      }

      if (res.status === 410) {
        setPageState("expired");
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // 如果是 401（未登入），繼續等 auth
        if (res.status === 401) {
          // auth 還在載入，等一下
          return;
        }
        setErrorMsg(err.error ?? "無法讀取邀請資訊");
        return;
      }

      const data = await res.json();
      setInviteInfo({
        listName: data.listName,
        listIcon: data.listIcon ?? "📋",
        inviterName: data.inviterName ?? "某人",
        role: data.role ?? "editor",
        inviteeEmail: data.inviteeEmail ?? "",
      });

      // 若已登入，檢查 email 是否對應
      if (user) {
        const userEmail = (user.email ?? "").toLowerCase();
        if (data.inviteeEmail && userEmail !== data.inviteeEmail.toLowerCase()) {
          setPageState("wrong_email");
          return;
        }
        setPageState("authenticated");
      }
    } catch {
      setErrorMsg("網路錯誤，請稍後再試");
    }
  }, [token, user]);

  useEffect(() => {
    if (!authLoading) {
      void verifyToken();
    }
  }, [authLoading, verifyToken]);

  // auth 狀態變化時重新檢查
  useEffect(() => {
    if (!user || !inviteInfo) return;
    const userEmail = (user.email ?? "").toLowerCase();
    if (inviteInfo.inviteeEmail && userEmail !== inviteInfo.inviteeEmail.toLowerCase()) {
      setPageState("wrong_email");
    } else {
      setPageState("authenticated");
    }
  }, [user, inviteInfo]);

  // ── 加入清單 ────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!user) {
      // 導去登入，回來時帶著 token
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    setPageState("joining");

    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      const accessToken = sessionData?.accessToken;

      if (!accessToken) {
        toast.error("請重新登入後再試");
        router.push("/login");
        return;
      }

      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.status === 409 && data.error?.includes("already a member")) {
        setPageState("already_member");
        return;
      }

      if (res.status === 410) {
        setPageState("expired");
        return;
      }

      if (res.status === 403) {
        setPageState("wrong_email");
        return;
      }

      if (!res.ok) {
        toast.error(data.error ?? "加入失敗");
        setPageState("authenticated");
        return;
      }

      setPageState("success");
      toast.success(`已加入「${data.listName ?? "共用清單"}」！`);
    } catch {
      toast.error("網路錯誤，請稍後再試");
      setPageState("authenticated");
    }
  };

  const roleLabel = inviteInfo?.role === "viewer" ? "檢視者（唯讀）" : "編輯者";

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading || pageState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <Loader2 className="w-10 h-10 mx-auto animate-spin mb-4" style={{ color: "var(--brand)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>讀取邀請中...</p>
        </motion.div>
      </div>
    );
  }

  if (pageState === "invalid_token") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,59,48,0.1)" }}>
            <AlertCircle className="w-7 h-7" style={{ color: "var(--status-danger)" }} />
          </div>
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>邀請無效</h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            這個邀請連結不存在或已被移除。
          </p>
        </motion.div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,149,0,0.1)" }}>
            <AlertCircle className="w-7 h-7" style={{ color: "var(--status-warning)" }} />
          </div>
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>邀請已過期</h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            這份邀請已超過 7 天有效期，請聯繫邀請人重新發送。
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full py-3 rounded-xl text-[14px] font-medium transition-all active:scale-95"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            返回首頁
          </button>
        </motion.div>
      </div>
    );
  }

  if (pageState === "wrong_email") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,149,0,0.1)" }}>
            <Mail className="w-7 h-7" style={{ color: "var(--status-warning)" }} />
          </div>
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>帳號不符</h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            這份邀請是發給 <strong>{inviteInfo?.inviteeEmail}</strong> 的，<br />
            請用這個帳號登入後再試。
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mt-5 w-full py-3 rounded-xl text-[14px] font-medium transition-all active:scale-95"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            前往登入
          </button>
        </motion.div>
      </div>
    );
  }

  if (pageState === "already_member") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.1)" }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: "var(--status-success)" }} />
          </div>
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>你已經是成員了</h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            你已經在「{inviteInfo?.listName}」清單中了，<br />直接去使用吧！
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full py-3 rounded-xl text-[14px] font-medium transition-all active:scale-95"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            前往使用
          </button>
        </motion.div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.1)" }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: "var(--status-success)" }} />
          </div>
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>加入成功！</h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            歡迎來到「{inviteInfo?.listName}」！<br />
            你將作為 <strong>{roleLabel}</strong> 參與這份清單。
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full py-3 rounded-xl text-[14px] font-medium transition-all active:scale-95"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            開始使用
          </button>
        </motion.div>
      </div>
    );
  }

  // 預設：authenticated 或 joining
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
      >
        {/* 清單資訊 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 text-3xl" style={{ background: "var(--surface-muted)" }}>
            {inviteInfo?.listIcon ?? "📋"}
          </div>
          <h1 className="text-[20px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            收到一份邀請
          </h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            <strong>{inviteInfo?.inviterName}</strong> 邀請你加入「{inviteInfo?.listName}」
          </p>
          <span className="inline-block mt-2 text-[11px] px-2.5 py-1 rounded-full" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
            將作為 {roleLabel}
          </span>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-[13px]" style={{ background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={pageState === "joining"}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "var(--brand)" }}
        >
          {pageState === "joining" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 加入中...</>
          ) : (
            <><Users className="w-4 h-4" /> 接受邀請並加入</>
          )}
        </button>

        {!user && (
          <p className="mt-3 text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            登入後才能加入清單
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-2 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          一次性邀請連結，安全保障
        </div>
      </motion.div>
    </div>
  );
}
