"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import {
  Mail, Lock, LogIn, AlertCircle, Loader2, ShieldCheck, CheckCircle2, ArrowLeft,
} from "lucide-react";

interface AuthPageProps {
  onGuestMode: () => void;
}

type AuthMode = "signin" | "signup" | "forgot" | "forgot-sent";

export function AuthPage({ onGuestMode }: AuthPageProps) {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, resetPasswordForEmail, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e.message || "Google 登入失敗");
    }
  };

  const handleApple = async () => {
    setError(null);
    try {
      await signInWithApple();
    } catch (e: any) {
      setError(e.message || "Apple 登入失敗");
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (e: any) {
      // Supabase Auth error codes
      const msg =
        e?.message?.includes("Invalid login credentials")
          ? "Email 或密碼錯誤"
          : e?.message?.includes("Email not confirmed")
          ? "請先至信箱點擊驗證連結"
          : e?.message?.includes("already registered")
          ? "此 Email 已被註冊"
          : e?.message?.includes("Password should be at least")
          ? "密碼至少需要 6 個字元"
          : e?.message?.includes("canceled")
          ? "已取消"
          : e?.message || "發生錯誤";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPasswordForEmail(email);
      setMode("forgot-sent");
    } catch (e: any) {
      const msg =
        e?.message?.includes("rate limit")
          ? "請求過於頻繁，請稍後再試"
          : e?.message?.includes("valid email")
          ? "Email 格式不正確"
          : e?.message?.includes("not found")
          ? "查無此 Email 帳號"
          : e?.message || "寄送失敗，請稍後再試";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--surface-muted)" }}
    >
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--brand)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: "var(--status-success)" }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--brand)" }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            VibeList
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            你的任務管理夥伴
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          {(mode === "signin" || mode === "signup") ? (
          <>
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => { setMode("signin"); setError(null); }}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-medium transition-all"
                style={
                  mode === "signin"
                    ? { background: "var(--brand-tint)", color: "var(--brand)" }
                    : { color: "var(--text-tertiary)" }
                }
              >
                登入
              </button>
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-medium transition-all"
                style={
                  mode === "signup"
                    ? { background: "var(--brand-tint)", color: "var(--brand)" }
                    : { color: "var(--text-tertiary)" }
                }
              >
                註冊
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-[13px]"
                style={{ background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-[14px] font-medium mb-4 transition-all active:scale-98"
              style={{ background: "var(--surface-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              使用 Google 帳號{mode === "signup" ? "註冊" : "登入"}
            </button>

            {/* Apple */}
            <button
              onClick={handleApple}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-[14px] font-medium mb-4 transition-all active:scale-98"
              style={{ background: "#000", color: "#fff", border: "1px solid #000" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#fff" d="M14.94 13.93c-.28.65-.62 1.25-1.02 1.79-.54.73-1.43 1.55-2.31 1.56-.78.01-1.16-.5-2.16-.5s-1.4.49-2.15.51c-.88.02-1.55-.79-2.1-1.52-1.18-1.57-2.09-4.43-.87-6.36.61-.96 1.69-1.57 2.87-1.58.85-.02 1.66.57 2.18.57s1.53-.7 2.59-.6c.44.02 1.69.18 2.49 1.36-.07.04-1.49.87-1.47 2.6.02 2.07 1.81 2.76 1.83 2.77-.02.05-.29.99-.88 1.7zM12.45 4.79c.46-.55.77-1.32.68-2.08-.66.03-1.46.44-1.93 1-.42.49-.79 1.27-.69 2.01.74.06 1.49-.38 1.94-.93z"/>
              </svg>
              使用 Apple 帳號{mode === "signup" ? "註冊" : "登入"}
            </button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "var(--border)" }} />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-[12px]" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  或使用 Email
                </span>
              </div>
            </div>

            {/* Email form */}
            <form onSubmit={handleEmail} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="input pl-10"
                    style={{ fontSize: 14 }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    密碼
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); }}
                      className="text-[12px] underline underline-offset-2"
                      style={{ color: "var(--brand)" }}
                    >
                      忘記密碼？
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                disabled={submitting || !email || !password}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-medium text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--brand)" }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    {mode === "signin" ? "登入" : "建立帳號"}
                  </>
                )}
              </button>
            </form>
          </>
        ) : mode === "forgot" ? (
          <>
            <div className="mb-5">
              <button
                onClick={() => { setMode("signin"); setError(null); }}
                className="flex items-center gap-1 text-[13px] mb-3 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回登入
              </button>
              <h2 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>
                重設密碼
              </h2>
              <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                輸入註冊時使用的 Email，我們會寄送重設連結到您的信箱。
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-[13px]"
                style={{ background: "rgba(255,59,48,0.08)", color: "var(--status-danger)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoFocus
                    className="input pl-10"
                    style={{ fontSize: 14 }}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-medium text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--brand)" }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "寄送重設連結"
                )}
              </button>
            </form>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="text-center py-2"
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ background: "var(--status-success)", opacity: 0.15 }}
            >
              <CheckCircle2 className="w-7 h-7" style={{ color: "var(--status-success)" }} />
            </div>
            <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              重設連結已寄出
            </h2>
            <p className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>
              我們已將重設連結寄送至
            </p>
            <p className="text-[13px] font-medium mb-5" style={{ color: "var(--text-primary)" }}>
              {email}
            </p>
            <p className="text-[12px] mb-6" style={{ color: "var(--text-tertiary)" }}>
              請於 1 小時內點擊信件中的連結完成重設。<br />
              沒收到？請檢查垃圾信件夾。
            </p>
            <button
              onClick={() => { setMode("signin"); setError(null); }}
              className="text-[13px] underline underline-offset-2"
              style={{ color: "var(--brand)" }}
            >
              返回登入
            </button>
          </motion.div>
        )}
        </motion.div>

        {/* Guest mode */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 text-center"
        >
          <button
            onClick={onGuestMode}
            className="text-[13px] underline underline-offset-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            暫時略過，先以訪客模式使用
          </button>
        </motion.div>

        {/* Privacy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex items-center justify-center gap-2 text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          資料加密儲存 · 符合 GDPR 規範
        </motion.div>

        <p className="text-center text-[12px] mt-3" style={{ color: "var(--text-tertiary)" }}>
          登入即表示您同意我們的{" "}
          <a href="/terms" className="underline" style={{ color: "var(--brand)" }}>服務條款</a>
          {" "}和{" "}
          <a href="/privacy" className="underline" style={{ color: "var(--brand)" }}>隱私權政策</a>
        </p>
      </div>
    </div>
  );
}
