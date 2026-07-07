import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TaskFlow - 任務管理",
    template: "%s | TaskFlow",
  },
  description: "優雅高效的任務管理工具，讓你輕鬆掌控每一項待辦事項",
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
      <body className="min-h-screen antialiased bg-[var(--surface-muted)]">
        {children}
      </body>
    </html>
  );
}
