import { Suspense } from "react";
import ZenHomeShell from "@/components/ZenHomeShell";
import ZenDashboard from "@/components/ZenDashboard";

export const metadata = {
  title: "VibeList · 禪模式",
  description: "一次只做一件事的極簡預設畫面",
};

export default function HomePage() {
  // §26-G 預防:useSearchParams 必須在 Suspense 內,否則 build 失敗
  return (
    <Suspense fallback={<ZenDashboard />}>
      <ZenHomeShell />
    </Suspense>
  );
}
