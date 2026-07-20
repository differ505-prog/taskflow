"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Lock, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // AuthContext 的 onAuthStateChange 會在 cookie 設定後自動拿到 user。
  // 若 user 仍未到位但 loading=false → 連結已過期或無效。
  const sessionReady = !loading && user;

  useEffect(() => {
    if (!loading && !user) {
      // 連結過期或無效 → 導回登入頁
      const timer = setTimeout(() => router.push("/"), 2500);
      return () => clearTimeout(timer);
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("密碼至少需要 6 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      setDone(true);
      setTimeout(() => router.push("/"), 2000);
    } catch (e: any) {
      const msg =
        e?.message?.includes("same as the old")
          ? "新密碼不可與舊密碼相同"
          : e?.message?.includes("weak")
          ? "密碼強度不足,請使用更複雜的密碼"
          : e?.message?.includes("Auth session missing")
          ? "重設連結已過期,請重新申請"
          : e?.message || "更新失敗,請稍後再試";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm rounded-2xl p-6 text-center"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
            style={{ background: "var(--status-success)", opacity: 0.15 }}
          >
            <CheckCircle2 className="w-7 h-7" style={{ color: "var(--status-success)" }} />
          </div>
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            密碼已更新
          </h1>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            正在為您登入並導回首頁...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
        <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}>
          {loading ? (
            <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: "var(--brand)" }} />
          ) : (
            <>
              <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--status-danger)" }} />
              <h1 className="text-[16px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                重設連結已過期
              </h1>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                請返回登入頁重新申請重設連結。
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--surface-muted)" }}>
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <h1 className="text-[20px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            設定新密碼
          </h1>
          <p className="text-[13px] mb-5" style={{ color: "var(--text-secondary)" }}>
            為 {user?.email} 設定一組新密碼,至少 6 個字元。
          </p>

          {error && (
            <div
              className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-[13px]"
              style={{ background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                新密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoFocus
                  className="input pl-10"
                  style={{ fontSize: 14 }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                確認新密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input pl-10"
                  style={{ fontSize: 14 }}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !newPassword || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-medium text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--brand)" }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "更新密碼"
              )}
            </button>
          </form>
        </motion.div>

        <div className="mt-5 flex items-center justify-center gap-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          密碼以加密方式儲存,符合業界安全標準
        </div>
      </div>
    </div>
  );
}