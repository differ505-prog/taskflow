import type { Metadata } from "next";
import { StatsClient } from "@/components/StatsClient";

export const metadata: Metadata = {
  title: "統計",
  description: "檢視你的任務完成率與生產力趨勢分析",
  alternates: { canonical: "/stats" },
};

export default function StatsLayout() {
  return <StatsClient />;
}
