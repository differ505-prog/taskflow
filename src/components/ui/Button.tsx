"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Button — 統一按鈕元件
 *
 * 覆蓋全專案所有基礎按鈕視覺需求：
 *   variant="primary"  → 主要 CTA（品牌色 solid、hover 上浮）
 *   variant="ghost"    → 次要操作（透明底、hover 變灰）
 *   variant="danger"   → 危險操作（刪除等）
 *
 * size：
 *   sm       → 小型文字按鈕
 *   md       → 預設尺寸
 *   lg       → 大型
 *   icon-sm  → 小型 icon-only 按鈕（w-8 h-8，正圓）
 *
 * 其他專業按鈕不走此元件（職責分離）：
 *   - ProGhostButton   → 功能鎖定（Pro 門檻 gate）
 *   - GhostButton      → 假門測試（waitlist 流程）
 */

type ButtonVariant = "primary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon-sm";

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  danger: "btn-ghost",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-[12px] px-3 py-1.5",
  md: "text-[14px] px-4 py-2",
  lg: "text-[15px] px-6 py-3",
  "icon-sm": "w-8 h-8 p-0 flex items-center justify-center rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, BaseButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const dangerStyle: React.CSSProperties | undefined =
      variant === "danger"
        ? {
            color: "var(--status-danger)",
            background: "rgba(255, 59, 48, 0.06)",
            border: "1px solid rgba(255, 59, 48, 0.20)",
          }
        : undefined;

    const isIconOnly = !loading && !!icon && !children;

    const content = (
      <>
        {loading ? (
          <svg
            className="animate-spin flex-shrink-0"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : isIconOnly ? (
          icon
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
            )}
            {children && <span>{children}</span>}
            {icon && iconPosition === "right" && (
              <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
            )}
          </>
        )}
      </>
    );

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        style={dangerStyle}
        aria-busy={loading || undefined}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
