"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, User, Settings, ChevronDown, Loader2, Crown, Sparkles, Shield } from "lucide-react";

export function UserMenu() {
  const { user, signOut, loading, role, roleConfig } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName.slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() ?? "U";

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  const RoleIcon = role === "admin" ? Crown : role === "beta" ? Sparkles : Shield;
  const roleIconColor = roleConfig.badgeColor;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-black/5"
        aria-label="使用者選單"
        aria-expanded={open}
      >
        {/* Avatar */}
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || "使用者"}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
            style={{ background: "var(--brand)" }}
          >
            {initials}
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-[13px] font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
            {user.displayName || "使用者"}
          </p>
          <div className="flex items-center gap-1.5">
            <RoleIcon className="w-3 h-3" style={{ color: roleIconColor }} />
            <p className="text-[11px] leading-tight truncate max-w-[120px]" style={{ color: roleIconColor }}>
              {roleConfig.label}
            </p>
          </div>
        </div>
        <ChevronDown
          className="w-3.5 h-3.5 hidden sm:block transition-transform duration-200"
          style={{ color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50"
            style={{ background: "var(--surface-elevated)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}
          >
            {/* User info header */}
            <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0"
                    style={{ background: "var(--brand)" }}
                  >
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {user.displayName || "使用者"}
                  </p>
                  <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {user.email}
                  </p>
                  {/* Role Badge */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <RoleIcon className="w-3.5 h-3.5" style={{ color: roleIconColor }} />
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: roleConfig.badgeBg,
                        color: roleIconColor,
                      }}
                    >
                      {roleConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="py-2">
              <a
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 text-[14px] transition-colors hover:bg-black/5"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setOpen(false)}
              >
                <Settings className="w-4 h-4" />
                帳號設定
              </a>
              <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-[14px] transition-colors hover:bg-red-50"
                style={{ color: "var(--status-danger)" }}
              >
                <LogOut className="w-4 h-4" />
                登出
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
