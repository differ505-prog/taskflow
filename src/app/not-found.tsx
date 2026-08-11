import Link from "next/link";
import { Home, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * 404 — 頁面飄走了
 *
 * 對齊 VOICE_AND_TONE.md §2 「404」情境：
 * 帶品牌記憶點（呼應失物招領系列），把「找不到」轉成「被遺忘的失物」。
 * 字面上短、有靈魂、與 LostAndFound 同一系列。
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--surface-muted)]">
      <p
        className="text-[80px] font-bold leading-none mb-4"
        style={{ color: "var(--text-primary)", opacity: 0.06 }}
      >
        404
      </p>
      <div
        className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
        aria-hidden="true"
      >
        <ArchiveRestore className="w-7 h-7" style={{ color: "var(--brand)", opacity: 0.7 }} />
      </div>
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-[var(--text-primary)] mb-2 text-balance">
          這頁面飄走了
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] max-w-xs leading-relaxed text-pretty">
          它可能被改網址、或者正在去找失物招領的路上。
        </p>
      </div>
      <Link href="/" className="btn-primary">
        <Home className="w-4 h-4" aria-hidden="true" />
        帶我回首頁
      </Link>
    </div>
  );
}
