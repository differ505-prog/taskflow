"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Rocket, CheckCircle, Sparkles, Swords, Brain, Moon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { track } from "@/lib/analytics";

export default function WaitlistPage() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    track("waitlist_login_click");
    try {
      await signInWithGoogle();
    } catch {
      setLoading(false);
    }
  };

  // Framer Motion 變異配置
  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  const fadeUpDelay = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>
      {/* 背景裝飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full blur-[150px]"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-20%] right-[-15%] w-[600px] h-[600px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(120,119,198,0.04) 0%, transparent 70%)" }}
        />
      </div>

      {/* ===== Section 1: Hero ===== */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-24">
        <div className="w-full max-w-2xl mx-auto text-center">
          {/* H1 大標題 */}
          <motion.h1
            {...fadeUpDelay(0)}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-balance"
            style={{ color: "var(--text-primary)" }}
          >
            你需要的不是效率工具，是多巴胺。
          </motion.h1>

          {/* H2 副標題 */}
          <motion.p
            {...fadeUpDelay(0.1)}
            className="text-base md:text-lg leading-relaxed mb-16 max-w-xl mx-auto text-balance"
            style={{ color: "var(--text-secondary)" }}
          >
            看著一長串待辦清單，腦袋就當機完全不想動？
            <br />
            VibeList 是一款專為「啟動癱瘓」設計的極簡小工具。把枯燥的現實任務，變成充滿節奏感的進步體驗。
          </motion.p>

          {/* 任務卡片 Mockup + PP 徽章 */}
          <motion.div
            {...fadeUpDelay(0.2)}
            className="relative inline-block"
          >
            {/* 假的任務卡片 */}
            <div
              className="relative rounded-2xl p-6 w-72 mx-auto"
              style={{
                background: "var(--surface-elevated)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px var(--border)",
              }}
            >
              {/* 任務狀態指示 */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(52,199,89,0.12)" }}
                >
                  <CheckCircle className="w-5 h-5" style={{ color: "var(--status-success)" }} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[13px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                    健檢照腹部超音波
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    帶乾兒子去公園踢球
                  </p>
                </div>
              </div>

              {/* 經驗值條 */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  <span>LV. 12</span>
                  <span>2,450 / 3,000 PP</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-muted)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "82%" }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: "var(--brand)" }}
                  />
                </div>
              </div>
            </div>

            {/* 漂浮的 +100 PP 徽章 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, x: 40, y: -20 }}
              animate={{ opacity: 1, scale: 1, x: 40, y: -20 }}
              transition={{ duration: 0.6, delay: 0.8, type: "spring", stiffness: 200 }}
              className="absolute -top-2 -right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #eab308 100%)",
                color: "#000",
                boxShadow: "0 0 20px rgba(245,158,11,0.4), 0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              +100 PP
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== Section 2: Features ===== */}
      <section className="relative z-10 px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto">
          <motion.div
            {...fadeUpDelay(0)}
            className="text-center mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4" style={{ color: "var(--text-primary)" }}>
              為什麼 VibeList 不一樣
            </h2>
            <p className="text-[15px]" style={{ color: "var(--text-secondary)" }}>
              三個設計原則，只為一個目標：讓你願意開始
            </p>
          </motion.div>

          {/* 3 張玻璃擬物卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 卡片 1: 獨自升級 */}
            <motion.div
              {...fadeUpDelay(0.1)}
              className="group relative rounded-2xl p-6 backdrop-blur-xl border"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: "rgba(245,158,11,0.12)" }}
              >
                <Swords className="w-6 h-6" style={{ color: "#f59e0b" }} aria-hidden="true" />
              </div>
              <h3 className="text-[16px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                獨自升級的快感
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                完成任務瞬間觸發完成特效。PP 永遠只增不減，沒有連勝中斷的懲罰。
              </p>
            </motion.div>

            {/* 卡片 2: 禪模式 */}
            <motion.div
              {...fadeUpDelay(0.2)}
              className="group relative rounded-2xl p-6 backdrop-blur-xl border"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: "rgba(59,130,246,0.12)" }}
              >
                <Brain className="w-6 h-6" style={{ color: "var(--brand)" }} aria-hidden="true" />
              </div>
              <h3 className="text-[16px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                絕對防禦的禪模式
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                一次只看一件事。沒有複雜的標籤，沒有無盡的清單，幫大腦裝上降噪耳機。
              </p>
            </motion.div>

            {/* 卡片 3: 溫柔退場 */}
            <motion.div
              {...fadeUpDelay(0.3)}
              className="group relative rounded-2xl p-6 backdrop-blur-xl border"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: "rgba(167,139,250,0.12)" }}
              >
                <Moon className="w-6 h-6" style={{ color: "#a78bfa" }} aria-hidden="true" />
              </div>
              <h3 className="text-[16px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                溫柔的退場機制
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                沒有逼死人的紅色過期警告。累了？按下「今天先這樣」，剩下的任務我們會溫柔地幫你收好。
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== Section 3: CTA & Google OAuth ===== */}
      <section className="relative z-10 px-4 py-24 md:py-32">
        <div className="max-w-md mx-auto text-center">
          <motion.div
            {...fadeUpDelay(0)}
            className="mb-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4" style={{ color: "var(--text-primary)" }}>
              準備好開始了嗎？
            </h2>
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              限量 Beta 測試名額，先到先得
            </p>
          </motion.div>

          {/* Google OAuth 按鈕 */}
          <motion.div {...fadeUpDelay(0.1)}>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl text-[15px] font-semibold transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] cursor-pointer"
              style={{
                background: loading ? "var(--surface-muted)" : "var(--surface-elevated)",
                border: "2px solid var(--border)",
                boxShadow: "var(--shadow-md)",
                color: "var(--text-primary)",
              }}
            >
              {loading ? (
                <span className="animate-pulse">跳轉中...</span>
              ) : (
                <>
                  {/* Google 圖標 SVG */}
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  <Rocket className="w-4 h-4" aria-hidden="true" />
                  獲取限量 Beta 測試資格
                </>
              )}
            </button>

            {/* 微文案 */}
            <p
              className="mt-4 text-[12px] leading-relaxed"
              style={{ color: "var(--text-tertiary)" }}
            >
              免註冊，直接使用 Google 登入。
              <br />
              保證沒有壓力，就算你登入後忘記打開，我們也完全能理解 😂
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center relative z-10">
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          © 2026 VibeList · 為你的大腦設計
        </p>
      </footer>
    </div>
  );
}
