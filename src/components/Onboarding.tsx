"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, ShoppingBag, Code2, GraduationCap, Github, Sparkles, ArrowRight, SkipForward } from "lucide-react";
import { TEMPLATES, applyTemplate } from "@/lib/templates";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { translateError } from "@/lib/errorMessages";

const ONBOARDING_KEY_PREFIX = "taskflow_onboarding_v1_done";

interface RoleCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  recommendedTemplateId: string;
  color: string;
}

const ROLES: RoleCard[] = [
  {
    id: "freelancer",
    icon: <Briefcase className="w-6 h-6" />,
    title: "自由工作者",
    subtitle: "接案、報價、催款",
    description: "幫你打理結案、請款、催收節奏,不再被拖款。",
    recommendedTemplateId: "freelancer-invoice",
    color: "#3B82F6",
  },
  {
    id: "ecommerce",
    icon: <ShoppingBag className="w-6 h-6" />,
    title: "電商賣家",
    subtitle: "出貨、退換、客服",
    description: "退換貨、補寄、案例彙整的標準作業流。",
    recommendedTemplateId: "ecommerce-returns",
    color: "#F97316",
  },
  {
    id: "developer",
    icon: <Code2 className="w-6 h-6" />,
    title: "獨立開發者",
    subtitle: "產品開發、上線",
    description: "從 side project 到正式 launch 的關鍵節點不漏接。",
    recommendedTemplateId: "indie-launch",
    color: "#22C55E",
  },
];

interface OnboardingProps {
  /** 強制顯示(用於 SettingsPage 內的「重新開始 Onboarding」按鈕) */
  forceShow?: boolean;
  onClose?: () => void;
}

export function Onboarding({ forceShow = false, onClose }: OnboardingProps) {
  const { addTaskLocalOnly, addList, tasks, isAppReady } = useApp();
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // §修法 A:per-user sentinel, 若為訪客模式則使用預設 prefix
  const onboardingKey = user?.uid ? `${ONBOARDING_KEY_PREFIX}_${user.uid}` : ONBOARDING_KEY_PREFIX;

  const [isVisible, setIsVisible] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!forceShow && typeof window !== "undefined") {
      if (localStorage.getItem(onboardingKey) === "1") {
        setIsVisible(false);
      }
    }
    setIsInitialized(true);
  }, [loading, onboardingKey, forceShow]);

  // §自動隱藏：若為老用戶跨裝置登入，系統載入完成後發現已有任務，則自動視為已完成 Onboarding
  useEffect(() => {
    if (!isVisible || !isAppReady || forceShow) return;
    if (tasks.length > 0) {
      try {
        localStorage.setItem(onboardingKey, "1");
      } catch {}
      setIsVisible(false);
    }
  }, [isVisible, isAppReady, tasks.length, forceShow, onboardingKey]);

  const markDone = () => {
    try {
      localStorage.setItem(onboardingKey, "1");
    } catch {}
    setIsVisible(false);
    onClose?.();
  };

  const handleApply = () => {
    if (!selected || busy) return;
    setBusy(true);
    const role = ROLES.find((r) => r.id === selected);
    if (!role) { setBusy(false); return; }
    const template = TEMPLATES.find((t) => t.id === role.recommendedTemplateId);
    if (!template) { setBusy(false); return; }
    try {
      // §修法 A:範本任務也走 addTaskLocalOnly(系統一次性教學/範本)
      // → 不上雲端 → 登出再登入不會殘留污染
      const { taskIds } = applyTemplate(template, {
        addList,
        addTask: (data) => {
          const ids = addTaskLocalOnly([data]);
          return ids[0];
        },
      });
      toast.success(
        `已套用「${template.name}」,新增 ${taskIds.length} 個任務`,
        { description: "從左側清單開始你的第一週。" }
      );
      markDone();
    } catch (err) {
      console.error("[Onboarding] Apply failed:", err);
      toast.error(translateError(err, "建立範本失敗,請稍後再試"));
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    markDone();
  };

  // 在 auth 狀態確認前不渲染，避免閃爍
  if (loading || !isInitialized) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="card w-full max-w-2xl p-6 sm:p-8 shadow-2xl relative bg-white dark:bg-zinc-900 max-h-[90dvh] overflow-y-auto overscroll-contain"
            >
              {/* Header */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
              style={{ background: "var(--brand-tint)" }}
              aria-hidden="true"
            >
              <Sparkles className="w-6 h-6" style={{ color: "var(--brand)" }} />
            </div>
            <h2
              id="onboarding-title"
              className="text-[20px] sm:text-[22px] font-semibold mb-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              歡迎來到 TaskFlow
            </h2>
            <p className="text-[13px] sm:text-[14px]" style={{ color: "var(--text-secondary)" }}>
              選擇最接近你身分的角色,我們會預載一組範本任務讓你立刻開始。
            </p>
          </div>

          {/* Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {ROLES.map((role) => {
              const isSelected = selected === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelected(role.id)}
                  disabled={busy}
                  className="text-left p-4 rounded-2xl transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: isSelected ? `${role.color}12` : "var(--surface-muted)",
                    border: `2px solid ${isSelected ? role.color : "transparent"}`,
                    boxShadow: isSelected ? `0 0 0 4px ${role.color}1A` : "none",
                  }}
                  aria-pressed={isSelected}
                  aria-label={`選擇角色：${role.title}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${role.color}1A`, color: role.color }}
                    aria-hidden="true"
                  >
                    {role.icon}
                  </div>
                  <p
                    className="text-[14px] font-semibold mb-0.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {role.title}
                  </p>
                  <p
                    className="text-[11px] font-medium mb-2"
                    style={{ color: role.color }}
                  >
                    {role.subtitle}
                  </p>
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {role.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Hint */}
          <p
            className="text-[12px] text-center mb-5 flex items-center justify-center gap-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
            學生? 你也可以從 <span style={{ color: "var(--brand)" }}>「設定 → 範本市集」</span> 套用「期末週衝刺」範本。
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            {!showSkipConfirm ? (
              <>
                <button
                  onClick={() => setShowSkipConfirm(true)}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-95 disabled:opacity-60 flex items-center gap-1"
                  style={{ background: "transparent", color: "var(--text-tertiary)" }}
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  略過,從空白開始
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleApply}
                  disabled={!selected || busy}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: "var(--brand)", color: "white" }}
                >
                  {busy ? (
                    <>建立中...</>
                  ) : (
                    <>
                      開始我的第一週
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <p
                  className="flex-1 text-[12px] flex items-center"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Github className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                  略過後仍可在「設定 → 範本市集」隨時套用。
                </p>
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
                >
                  返回選擇
                </button>
                <button
                  onClick={handleSkip}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: "var(--surface-muted)", color: "var(--text-primary)" }}
                >
                  確認略過
                </button>
              </>
            )}
          </div>
        </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 對外暴露的檢查 helper,給 AppLayout 使用 */
export function hasCompletedOnboarding(uid?: string | null): boolean {
  if (typeof window === "undefined") return true;
  const key = uid ? `${ONBOARDING_KEY_PREFIX}_${uid}` : ONBOARDING_KEY_PREFIX;
  return localStorage.getItem(key) === "1";
}
