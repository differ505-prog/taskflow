"use client";

import { useState } from "react";
import { AuthProvider } from "@/lib/AuthContext";
import { AppProvider } from "@/lib/AppContext";
import { AuthGate } from "@/components/AuthGate";
import { FirebaseDataProvider, SyncWriter } from "@/components/FirebaseDataProvider";
import { ZenFlowProvider } from "@/lib/ZenFlowProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { useAuth } from "@/lib/AuthContext";

const OMNISONIC_URL = process.env.NEXT_PUBLIC_OMNISONIC_URL ?? "";

/**
 * 全域 Provider 鏈 — Auth → AuthGate → App → ZenFlow → Firebase。
 *
 * 設計動機 (§26-M):讓任意路由(/zen /command-center /settings 等)的子孫元件
 * 都能 useApp() 取真實任務資料,而不必在每個路由層各自包 Provider。
 *
 * 業務元件(Sidebar / TaskDetailPanel 等)不掛這裡,只在首頁 AppLayout 內掛。
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [guestModeEntered, setGuestModeEntered] = useState(false);

  return (
    <AuthProvider>
      <AuthGate onGuestEnter={() => setGuestModeEntered(true)}>
        <AppProvider>
          <ZenFlowProvider omnisonicBaseUrl={OMNISONIC_URL}>
            <FirebaseDataProvider>
              <SyncWriterGate />
              <ToastProvider />
              {children}
            </FirebaseDataProvider>
          </ZenFlowProvider>
        </AppProvider>
      </AuthGate>
    </AuthProvider>
  );
}

/** SyncWriter 需要登入後才有 user.uid,獨立元件讓 useAuth hook 可用 */
function SyncWriterGate() {
  const { user } = useAuth();
  if (!user) return null;
  return <SyncWriter userId={user.uid} />;
}