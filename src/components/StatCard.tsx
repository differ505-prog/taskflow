"use client";

import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon?: ReactNode;
  highlight?: boolean;
}

export function StatCard({ label, value, sub, icon, highlight }: StatCardProps) {
  return (
    <div className="card px-5 py-4 relative overflow-hidden">
      {icon && (
        <div className="absolute top-4 right-4 opacity-20" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
        {label}
      </p>
      <p
        className="text-[28px] font-semibold leading-none tracking-tight"
        style={{
          color: highlight ? "var(--brand)" : "var(--text-primary)",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{sub}</p>
      )}
    </div>
  );
}
