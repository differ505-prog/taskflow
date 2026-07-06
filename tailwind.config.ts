import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          foreground: "var(--brand-foreground)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          elevated: "var(--surface-elevated)",
        },
        border: {
          subtle: "var(--border-subtle)",
        },
        priority: {
          high: "var(--priority-high)",
          medium: "var(--priority-medium)",
          low: "var(--priority-low)",
        },
        status: {
          success: "var(--status-success)",
          warning: "var(--status-warning)",
          danger: "var(--status-danger)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "soft-sm": "0 1px 3px 0 var(--shadow-color)",
        "soft-md": "0 4px 12px 0 var(--shadow-color)",
        "soft-lg": "0 8px 24px 0 var(--shadow-color)",
        "glass": "0 8px 32px 0 var(--shadow-color)",
      },
      backdropBlur: {
        glass: "16px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      textBalance: {},
    },
  },
  plugins: [],
};

export default config;
