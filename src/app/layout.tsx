
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { BfcacheHandler } from "@/components/BfcacheHandler";
import { AppProviders } from "@/components/AppProviders";
import { TouchDebugger } from "@/components/TouchDebugger";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VibeList - 任務管理",
    template: "%s | VibeList",
  },
  description: "優雅高效的任務管理工具，讓你輕鬆掌控每一項待辦事項",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VibeList",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "https://vibelist.work/",
    siteName: "VibeList",
    title: "VibeList - 任務管理，優雅高效",
    description:
      "一次只做一件事的極簡任務管理工具。支援循環任務、子任務、番茄鐘、習慣追蹤、PWA 離線使用。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VibeList 任務管理",
      },
      {
        url: "/og-image-square.png",
        width: 1200,
        height: 1200,
        alt: "VibeList 任務管理",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeList - 任務管理，優雅高效",
    description:
      "一次只做一件事的極簡任務管理工具。支援循環任務、子任務、番茄鐘、習慣追蹤。",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://vibelist.work/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4F6AF5" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1C1E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={inter.variable}>
      <head>
        <link rel="icon" href="/icon-192.png?v=2" type="image/png" sizes="192x192" />
        <link rel="shortcut icon" href="/icon-192.png?v=2" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="VibeList" />
        <meta name="application-name" content="VibeList" />
        <meta name="msapplication-TileColor" content="#4F6AF5" />
        {/* V14 原生監聽：繞過 React 直接偵測瀏覽器底層 touch 事件 */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('touchstart', function(e) {
            var el = document.getElementById('debug-vanilla');
            if (!el) {
              el = document.createElement('div');
              el.id = 'debug-vanilla';
              el.style.cssText = 'position:fixed;top:0;right:0;background:red;color:white;z-index:9999999;padding:10px;font-size:14px;pointer-events:none;font-weight:bold;';
              document.body.appendChild(el);
            }
            var touch = e.touches[0];
            el.innerText = '原生觸控: ' + (touch ? touch.clientX + ',' + touch.clientY : 'null') + ' | ' + Date.now();
          }, { capture: true, passive: true });
          window.addEventListener('click', function(e) {
            var el = document.getElementById('debug-vanilla');
            if (el) {
              el.innerText = '原生Click: ' + e.clientX + ',' + e.clientY + ' | ' + Date.now();
            }
          }, { capture: true, passive: true });
        }} />
      </head>
      <body className="min-h-screen antialiased bg-[var(--surface-muted)]">
        <BfcacheHandler />
        <ConfirmProvider>
          <AppProviders>{children}</AppProviders>
        </ConfirmProvider>
        <ServiceWorkerRegister />
        <Analytics />
        <TouchDebugger />
      </body>
    </html>
  );
}
