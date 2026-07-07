"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { AuthPage } from "@/components/AuthPage";
import { Loader2 } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
  /** Called when user chooses to enter as guest (localStorage mode) */
  onGuestEnter: () => void;
}

export function AuthGate({ children, onGuestEnter }: AuthGateProps) {
  const { user, loading } = useAuth();
  const [guestMode, setGuestMode] = useState(false);

  // Check for guest mode flag
  useEffect(() => {
    const saved = localStorage.getItem("taskflow_guest_mode");
    if (saved === "true") setGuestMode(true);
  }, []);

  const handleGuestMode = () => {
    localStorage.setItem("taskflow_guest_mode", "true");
    setGuestMode(true);
    onGuestEnter();
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "var(--surface-muted)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "var(--brand)" }}
        >
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          載入中...
        </p>
      </div>
    );
  }

  // Logged in or guest mode → show app
  if (user || guestMode) {
    return <>{children}</>;
  }

  // Not logged in → show auth page
  return <AuthPage onGuestMode={handleGuestMode} />;
}
