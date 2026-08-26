"use client";

import { LandingPage } from "@/components/LandingPage";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleGuestMode = () => {
    localStorage.setItem("taskflow_guest_mode", "true");
    router.push("/");
  };

  return <LandingPage onGuestMode={handleGuestMode} />;
}
