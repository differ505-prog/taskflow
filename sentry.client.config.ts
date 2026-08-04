import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // 調整 tracesSampleRate:production 採 20%,避免量大炸掉 quota
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // dev 環境不打上報,避免污染
  enabled: process.env.NODE_ENV === "production",

  // Next.js 15 RSC + client component 都涵蓋
  integrations: [],

  // PII 不主動送:Supabase auth token / email 由 beforeSend 過濾
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },

  // 環境標籤方便 Sentry Dashboard 分組
  environment: process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;