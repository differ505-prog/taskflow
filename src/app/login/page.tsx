import { AuthGate } from "@/components/AuthGate";

export const metadata = {
  title: "登入 — VibeList",
  description: "登入或註冊 VibeList 帳號",
};

export default function LoginPage() {
  return <AuthGate />;
}
