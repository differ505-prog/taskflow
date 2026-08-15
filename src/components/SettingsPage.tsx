"use client";

import { useEffect, useCallback } from "react";
import { Moon, Sun, X } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import { isComposingKey } from "@/utils/imeGuard";
import { ProFeaturesSection } from "./SettingsSections/ProFeaturesSection";
import { KeyboardShortcutsSection } from "./SettingsSections/KeyboardShortcutsSection";
import { AccountSection } from "./SettingsSections/AccountSection";
import { AboutSection } from "./SettingsSections/AboutSection";
import { SettingsProvider, useSettingsContext } from "./SettingsSections/SettingsContext";
import { NotificationsSection } from "./SettingsSections/NotificationsSection";
import { InteractionSection } from "./SettingsSections/InteractionSection";
import { DataSection } from "./SettingsSections/DataSection";
import { CalendarSection } from "./SettingsSections/CalendarSection";
import { WebhookSection } from "./SettingsSections/WebhookSection";

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPage({ isOpen, onClose }: SettingsPageProps) {
  const {
    notificationPermission,
    requestNotificationPermission,
    setNotificationPermission,
    tasks,
    habits,
    lists,
    addTask,
    addHabit,
    addList,
  } = useApp();
  const { user, role, roleConfig, isAdmin } = useAuth();
  const { theme: themeValue, setTheme: setThemeCtx } = useSettingsContext();

  // ── Theme ─────────────────────────────────────────────────
  const applyTheme = useCallback((t: "light" | "dark" | "system") => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = t === "dark" || (t === "system" && prefersDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "");
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("taskflow_theme") as "light" | "dark" | "system" | null;
    if (saved) {
      setThemeCtx(saved);
      applyTheme(saved);
    }
  }, [applyTheme, setThemeCtx]);

  const handleThemeChange = (t: "light" | "dark" | "system") => {
    setThemeCtx(t);
    localStorage.setItem("taskflow_theme", t);
    applyTheme(t);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <SettingsProvider
        isOpen={isOpen}
        notificationPermission={notificationPermission}
        setNotificationPermission={setNotificationPermission}
        userId={user?.id ?? null}
      >
        <motion.div
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl"
          style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)" }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 py-5"
            style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--border)" }}
          >
            <h2 id="settings-title" className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
              設定
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-colors duration-200 hover:bg-[var(--hover-bg)]"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="關閉設定"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Theme */}
            <section>
              <h3 className="text-[12px] font-semibold tracking-tight mb-3" style={{ color: "var(--text-tertiary)" }}>
                外觀
              </h3>
              <div className="flex gap-2">
                {([
                  { value: "light" as const, label: "淺色", icon: <Sun className="w-4 h-4" /> },
                  { value: "dark" as const, label: "深色", icon: <Moon className="w-4 h-4" /> },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleThemeChange(opt.value)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-medium transition-all duration-150 border"
                    aria-label={`切換至${opt.label}模式`}
                    aria-pressed={themeValue === opt.value}
                    style={
                      themeValue === opt.value
                        ? { background: "var(--brand-tint)", borderColor: "var(--brand)", color: "var(--brand)" }
                        : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                    }
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <ProFeaturesSection />
            <AccountSection />
            <NotificationsSection
              notificationPermission={notificationPermission}
              requestNotificationPermission={requestNotificationPermission}
            />
            <InteractionSection />
            <DataSection
              tasks={tasks}
              habits={habits}
              lists={lists}
              addTask={addTask}
              addHabit={addHabit}
              addList={addList}
            />
            <CalendarSection />
            <WebhookSection />
            <AboutSection />
          </div>
        </motion.div>
      </SettingsProvider>
    </motion.div>
  );
}
