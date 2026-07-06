"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, BarChart3, Tags, Settings } from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/",
    label: "任務",
    icon: ClipboardList,
    exact: true,
  },
  {
    href: "/stats",
    label: "統計",
    icon: BarChart3,
    exact: false,
  },
  {
    href: "/tags",
    label: "標籤",
    icon: Tags,
    exact: false,
  },
  {
    href: "/settings",
    label: "設定",
    icon: Settings,
    exact: false,
  },
];

export function Nav() {
  const pathname = usePathname();

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 glass"
      role="navigation"
      aria-label="主導航"
    >
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-stretch justify-around h-[60px]">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-200 min-w-0"
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon
                  className="w-5 h-5 transition-all duration-200"
                  style={{
                    color: active ? "var(--brand)" : "var(--text-tertiary)",
                    transform: active ? "scale(1.05)" : "scale(1)",
                  }}
                  aria-hidden="true"
                />
                <span
                  className="text-[11px] font-medium transition-all duration-200 leading-none"
                  style={{
                    color: active ? "var(--brand)" : "var(--text-tertiary)",
                  }}
                >
                  {item.label}
                </span>
                {active && (
                  <span
                    className="absolute bottom-1 w-1 h-1 rounded-full"
                    style={{ background: "var(--brand)" }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
