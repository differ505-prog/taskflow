"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("taskflow_gdpr_consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("taskflow_gdpr_consent", "accepted");
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem("taskflow_gdpr_consent", "rejected");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-[100]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="mx-4 mb-4 rounded-2xl p-5 shadow-lg"
        style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--brand-tint)" }}
          >
            <ShieldCheck className="w-5 h-5" style={{ color: "var(--brand)" }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              尊重您的隱私
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              TaskFlow 使用瀏覽器本地儲存來保存您的資料。我們使用 cookies 來改善使用體驗，並在您允許的情況下發送任務到期提醒。
              詳見{" "}
              <a href="/privacy" className="underline" style={{ color: "var(--brand)" }}>
                隱私權政策
              </a>{" "}
              和{" "}
              <a href="/terms" className="underline" style={{ color: "var(--brand)" }}>
                服務條款
              </a>{" "}
              。
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReject}
            className="flex-1 py-3 rounded-xl text-[14px] font-medium transition-all active:scale-95"
            style={{ background: "rgba(0,0,0,0.05)", color: "var(--text-secondary)" }}
          >
            只保留必要
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-3 rounded-xl text-[14px] font-medium text-white transition-all active:scale-95"
            style={{ background: "var(--brand)" }}
          >
            全部接受
          </button>
        </div>
      </div>
    </motion.div>
  );
}
