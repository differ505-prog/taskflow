import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--surface-muted)]">
      <p className="text-[80px] font-bold leading-none mb-4" style={{ color: "var(--text-primary)", opacity: 0.06 }}>
        404
      </p>
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-[var(--text-primary)] mb-2">
          頁面不存在
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] max-w-xs leading-relaxed">
          頁面可能已被移除或網址有誤
        </p>
      </div>
      <Link href="/" className="btn-primary">
        <Home className="w-4 h-4" aria-hidden="true" />
        返回首頁
      </Link>
    </div>
  );
}
