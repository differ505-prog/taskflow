"use client";

/**
 * SettingsPage — 外層容器
 *
 * 職責：
 * - 持 useApp / useAuth hooks（需在 context 外層才能使用）
 * - Theme init（localStorage → context state + DOM apply）
 * - 回傳 null 當 !isOpen
 * - 內層 SettingsContent 使用 SettingsContext
 */
import { useEffect, useCallback } from "react";
import { Moon, Sun, X } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/AppContext";
import { useAuth } from "@/lib/AuthContext";
import {
  AccountSection,
  AboutSection,
  CalendarSection,
  DataSection,
  InteractionSection,
  KeyboardShortcutsSection,
  NotificationsSection,
  ProFeaturesSection,
  WebhookSection,
  SettingsProvider,
} from "./SettingsSections";

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

  // ── Theme apply（module-level，SettingsPage mount 時執行一次）─────
  const applyTheme = useCallback((t: "light" | "dark" | "system") => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = t === "dark" || (t === "system" && prefersDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "");
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("taskflow_theme") as "light" | "dark" | "system" | null;
    if (saved) applyTheme(saved);
  }, [applyTheme]);

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
        applyTheme={applyTheme}
      >
        <SettingsContent
          notificationPermission={notificationPermission}
          requestNotificationPermission={requestNotificationPermission}
          tasks={tasks}
          habits={habits}
          lists={lists}
          addTask={addTask}
          addHabit={addHabit}
          addList={addList}
          onClose={onClose}
        />
      </SettingsProvider>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SettingsContent — 內層，使用 SettingsContext
   ───────────────────────────────────────────────────────────── */

import { useSettingsContext } from "./SettingsSections";

interface SettingsContentProps {
  notificationPermission: NotificationPermission | "default";
  requestNotificationPermission: () => Promise<boolean>;
  tasks: ReturnType<typeof useApp>["tasks"];
  habits: ReturnType<typeof useApp>["habits"];
  lists: ReturnType<typeof useApp>["lists"];
  addTask: ReturnType<typeof useApp>["addTask"];
  addHabit: ReturnType<typeof useApp>["addHabit"];
  addList: ReturnType<typeof useApp>["addList"];
  onClose: () => void;
}

function SettingsContent({
  notificationPermission,
  requestNotificationPermission,
  tasks,
  habits,
  lists,
  addTask,
  addHabit,
  addList,
  onClose,
}: SettingsContentProps) {
  const { theme: themeValue, setTheme: setThemeCtx } = useSettingsContext();

  const handleThemeChange = (t: "light" | "dark" | "system") => {
    setThemeCtx(t);
    localStorage.setItem("taskflow_theme", t);
    document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "");
  };

  return (
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
  );
}
