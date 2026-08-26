"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { translateAuthError } from "@/lib/errorMessages";
import { Loader2 } from "lucide-react";

interface LandingPageProps {
  onGuestMode: () => void;
}

export function LandingPage({ onGuestMode }: LandingPageProps) {
  const { signInWithGoogle, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error_description") || params.get("error");
    if (err) {
      setError(`登入失敗：${decodeURIComponent(err.replace(/\+/g, " "))}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleGoogle = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(translateAuthError(e));
      setSigningIn(false);
    }
  };

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "var(--surface-muted)" }}
      >
        <Loader2 className="w-7 h-7 text-brand animate-spin mb-3" />
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          準備中...
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 overflow-hidden"
      style={{ background: "var(--surface-muted)" }}
    >
      {/* Ambient background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute -top-48 -right-48 w-[28rem] h-[28rem] rounded-full opacity-10 blur-3xl"
          style={{ background: "var(--brand)" }}
        />
        <div
          className="absolute -bottom-48 -left-48 w-[28rem] h-[28rem] rounded-full opacity-8 blur-3xl"
          style={{ background: "#818CF8" }}
        />
      </div>

      <div className="relative w-full max-w-xs flex flex-col items-center">

        {/* Logo wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <span
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            VibeList
          </span>
        </motion.div>

        {/* H1: 核彈級文案 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-5"
        >
          <h1
            className="text-[26px] font-semibold leading-snug text-balance"
            style={{ color: "var(--text-primary)" }}
          >
            你需要的不是效率工具，<br />
            <span style={{ color: "var(--brand)" }}>是多巴胺。</span>
          </h1>
        </motion.div>

        {/* H2: 極低調副標題 */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[13px] leading-relaxed mb-10"
          style={{ color: "var(--text-tertiary)" }}
        >
          專為啟動癱瘓設計的極簡防線。<br />
          <span className="text-[11px]">Beta 公測中。</span>
        </motion.p>

        {/* UI 截圖點綴：禪模式任務卡浮現 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 w-full max-w-[260px]"
        >
          <div
            className="rounded-2xl overflow-hidden shadow-lg"
            style={{
              background: "var(--surface)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          >
            {/* Simulated Zen task card */}
            <div className="px-4 py-3.5 flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{
                  background: "var(--surface-muted)",
                  border: "1.5px solid var(--border)",
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--text-tertiary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>
                  讀完這章
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  今天
                </p>
              </div>
            </div>
            {/* Glow accent line */}
            <div
              className="h-0.5 w-16 mx-4 mb-3 rounded-full"
              style={{ background: "var(--brand)" }}
            />
            {/* Second task (muted) */}
            <div className="px-4 pb-3.5 flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{
                  background: "var(--surface-muted)",
                  border: "1.5px solid var(--border)",
                }}
              >
                <div className="w-2 h-2 rounded-full opacity-40" style={{ background: "var(--text-tertiary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate opacity-40" style={{ color: "var(--text-primary)" }}>
                  下一步行動
                </p>
                <p className="text-[11px] opacity-40" style={{ color: "var(--text-tertiary)" }}>
                  明天
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 rounded-xl text-[13px] text-center w-full max-w-xs"
            style={{
              background: "rgba(255,59,48,0.08)",
              color: "var(--status-danger)",
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Primary CTA: Google */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xs"
        >
          <button
            onClick={handleGoogle}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-[15px] font-medium text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--brand)" }}
          >
            {signingIn ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                使用 Google 帳號登入
              </>
            )}
          </button>
        </motion.div>

        {/* Privacy note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="text-center text-[11px] mt-4"
          style={{ color: "var(--text-tertiary)" }}
        >
          開始無壓體驗
        </motion.p>

      </div>
    </div>
  );
}
