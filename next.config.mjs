/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

// Bundle Analyzer — 階段 6 量測用,只設 ANALYZE=true 時啟用
// 用法:ANALYZE=true npm run build → 產出 .next/analyze/*.html
const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? (await import("@next/bundle-analyzer")).default({ enabled: true })
  : (nextConfig) => nextConfig;

const nextConfig = {
  reactStrictMode: true,
  // 🔑 告訴 Next.js 15 不要把 firebase-admin 打包進 bundle，
  // 讓它在 runtime 走 Node.js require()。
  // 沒設這個會導致 firebase-admin 模組載入時 throw，500 連 try-catch 都接不到。
  serverExternalPackages: ["firebase-admin"],

  // 🔒 Security Headers (B 階段 1 / §10 首選 A)
  // - CSP 中等嚴格：保留 'unsafe-inline' / 'unsafe-eval' 是 Next.js 15 RSC + Tailwind JIT 必要
  // - 階段 4 接入 Sentry 後需補 https://*.sentry.io 到 connect-src / script-src
  // - 階段 6 bundle 瘦身後若移除 posthog，可縮 connect-src / script-src
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const csp = [
      "default-src 'self'",
      // script-src: Next.js RSC payload + PostHog + Vercel Analytics + Sentry (預留)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://*.vercel-scripts.com https://*.sentry.io",
      // style-src: Tailwind JIT inline style 必要
      "style-src 'self' 'unsafe-inline'",
      // img-src: 允許 https: 因為任務附件可能有外鏈；data: / blob: 給 avatar / 上傳預覽
      "img-src 'self' data: blob: https:",
      // font-src: data: 給 icon font inline
      "font-src 'self' data:",
      // connect-src: Supabase REST + Realtime (wss) + PostHog + Vercel Analytics + Sentry (預留)
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://*.vercel-scripts.com https://*.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          // dev 環境不送 HSTS，避免影響本機其他服務
          ...(isProd
            ? []
            : [{ key: "Strict-Transport-Security", value: "max-age=0" }]),
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(withSentryConfig(nextConfig, {
  // Sentry 提供的 source map upload 設定(只在 CI 環境用)
  // 沒設 SENTRY_AUTH_TOKEN 時 silent skip
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
}));