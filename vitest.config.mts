import { defineConfig } from "vitest/config";

/**
 * Vitest 設定
 *
 * 設計動機:專案採 Next.js + TS path aliases(@/lib/* 等),
 * 直接用 vite 內建 resolve.tsconfigPaths 讀 tsconfig.json 的 paths,免外部依賴。
 *
 * 排除:
 * - 排除 App Router 檔(避免 client component server boundary 報錯)
 * - 排除 hooks(避免需要 React Testing Library 才能跑)
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "jsdom",
  },
});
