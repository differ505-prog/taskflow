import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const BASE_URL = "https://taskflow.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "TaskFlow - 任務管理",
    template: "%s | TaskFlow",
  },
  description: "優雅高效的任務管理工具，讓你輕鬆掌控每一項待辦事項",
  keywords: ["任務管理", "待辦事項", "生產力", "todo", "task management"],
  authors: [{ name: "TaskFlow" }],
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: BASE_URL,
    siteName: "TaskFlow",
    title: "TaskFlow - 任務管理",
    description: "優雅高效的任務管理工具，讓你輕鬆掌控每一項待辦事項",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TaskFlow 任務管理工具",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TaskFlow - 任務管理",
    description: "優雅高效的任務管理工具，讓你輕鬆掌控每一項待辦事項",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen safe-top safe-bottom antialiased bg-[var(--surface-muted)]">
        <ErrorBoundary>
          {children}
          <Nav />
        </ErrorBoundary>
      </body>
    </html>
  );
}
