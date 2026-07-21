"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle, Sparkles } from "lucide-react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already">("idle");
  const [message, setMessage] = useState("");
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 載入目前的報名人數
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const existing = JSON.parse(localStorage.getItem("vibelist_waitlist") || "[]");
        setTotalCount(existing.length);
      } catch {
        setTotalCount(null);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.alreadyJoined) {
          setStatus("already");
          setMessage(data.message);
        } else {
          setStatus("success");
          setMessage(data.message);
          setTotalCount(data.total);
          setEmail("");
        }
      } else {
        setStatus("idle");
        setMessage(data.error || "發生錯誤，請稍後再試");
      }
    } catch {
      setStatus("idle");
      setMessage("網路錯誤，請檢查連線後再試");
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface)" }}>
      {/* 背景裝飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* 柔和漸層光暈 */}
        <div
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(120,119,198,0.05) 0%, transparent 70%)" }}
        />
      </div>

      {/* 主要內容 */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md mx-auto text-center">
          {/* Logo / 品牌 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="mb-10"
          >
            {/* 品牌標誌 */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
              style={{ background: "var(--brand-tint)" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path d="M5 14C5 8.48 9.48 4 14 4s9 4.48 9 10-4.48 10-9 10-9-4.48-9-10Z"
                  stroke="var(--brand)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9.5 14l2.5 2.5 6.5-6.5"
                  stroke="var(--brand)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* 標題 */}
            <h1 className="text-[28px] font-bold tracking-tight mb-3" style={{ color: "var(--text-primary)" }}>
              VibeList
            </h1>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              最笨、最安靜、只有一個按鈕的待辦清單
            </p>
          </motion.div>

          {/* 核心訊息區塊 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-10"
          >
            <div
              className="rounded-2xl p-6 text-left"
              style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-md)" }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(120,119,198,0.12)" }}>
                  <Sparkles className="w-4 h-4" style={{ color: "var(--text-secondary)" }} aria-hidden="true" />
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  市面上的工具都太複雜了。
                  <br />
                  <span style={{ color: "var(--text-secondary)" }}>
                    我們正在打造一款不懲罰你、不逼迫你，
                    <br />
                    只給你多巴胺的極簡清單。
                  </span>
                </p>
              </div>

              {/* ADHD 友善宣言 */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--surface-muted)" }}>
                <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                  給大腦過載的知識工作者
                </p>
                <ul className="text-[13px] space-y-1.5" style={{ color: "var(--text-secondary)" }}>
                  <li className="flex items-center gap-2">
                    <span style={{ color: "var(--status-success)" }}>✓</span>
                    沒有紅色過期警告
                  </li>
                  <li className="flex items-center gap-2">
                    <span style={{ color: "var(--status-success)" }}>✓</span>
                    沒有複雜的專案資料夾
                  </li>
                  <li className="flex items-center gap-2">
                    <span style={{ color: "var(--status-success)" }}>✓</span>
                    只有一個按鈕：輸入 → 完成
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Email 報名表單 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              {status === "success" || status === "already" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl p-6"
                  style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-md)" }}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(52,199,89,0.12)" }}
                    >
                      <CheckCircle className="w-6 h-6" style={{ color: "var(--status-success)" }} aria-hidden="true" />
                    </div>
                    <p className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {message}
                    </p>
                    {totalCount !== null && (
                      <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                        目前已有 {totalCount} 位朋友在等
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="form">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="你的 Email"
                        required
                        disabled={status === "loading"}
                        className="w-full px-5 py-4 rounded-2xl text-[15px] transition-all duration-200 focus:outline-none"
                        style={{
                          background: "var(--surface-elevated)",
                          border: "2px solid var(--border)",
                          boxShadow: "var(--shadow-sm)",
                          color: "var(--text-primary)",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "var(--brand)";
                          e.currentTarget.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.12), var(--shadow-sm)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                        }}
                      />
                    </div>

                    {message && (
                      <p className="text-[13px] text-center" style={{ color: "var(--status-danger)" }}>
                        {message}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={status === "loading" || !email.trim()}
                      className="w-full py-4 rounded-2xl text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: status === "loading" ? "var(--surface-muted)" : "var(--brand)",
                        color: "#fff",
                      }}
                    >
                      {status === "loading" ? (
                        <>
                          <span className="animate-pulse">傳送中...</span>
                        </>
                      ) : (
                        <>
                          加入限量邀請名單
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>

                  {totalCount !== null && totalCount > 0 && (
                    <p className="mt-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      目前已有 {totalCount} 位朋友在等
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 底部連結 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 pt-6"
          >
            <Link
              href="/login"
              className="text-[13px] transition-colors duration-150 hover:opacity-80"
              style={{ color: "var(--text-tertiary)" }}
            >
              已經有帳號？直接登入 →
            </Link>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          © 2026 VibeList · 為你的大腦設計
        </p>
      </footer>
    </div>
  );
}
