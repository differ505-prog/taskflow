/**
 * patch-sw.js — Build-time injection of unique cache hash into public/sw.js
 *
 * 目的：讓每次 build 自動產生新的 CACHE_NAME (e.g. taskflow-a1b2c3)，
 * 確保新 Service Worker 啟用時會清掉舊 cache、不會卡舊版。
 *
 * 觸發：package.json "postbuild" hook（在 next build 之後跑）
 * 順序關鍵：
 *   prebuild 跑 → 這時 .next/BUILD_ID 是上一次的（stale）或不存在（首次）
 *   postbuild 跑 → .next/BUILD_ID 一定是剛產的、跟當次 build 對應
 *
 * 流程：
 *   1. 讀取 .next/BUILD_ID（Next.js 當次 build 產物）
 *   2. 讀 public/sw.js 的內容，找出 CACHE_NAME 那一行
 *   3. 注入唯一 hash 寫回去
 *
 * 守則（§13）：
 * - 只改 CACHE_NAME 那一行，不動其他邏輯
 * - 用 regex 精準定位，避免誤改
 * - 用 CommonJS (require) 避免被 package.json "type": "module" 影響
 */

const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join, dirname } = require("node:path");

const SW_PATH = join(__dirname, "..", "public", "sw.js");
const BUILD_ID_PATH = join(__dirname, "..", ".next", "BUILD_ID");

function getBuildHash() {
  if (existsSync(BUILD_ID_PATH)) {
    const raw = readFileSync(BUILD_ID_PATH, "utf8").trim();
    return raw.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 12) || "dev";
  }
  return `dev-${Date.now().toString(36)}`;
}

function patchSw() {
  const hash = getBuildHash();
  const cacheName = `taskflow-${hash}`;

  let content = readFileSync(SW_PATH, "utf8");
  const before = content;
  content = content.replace(
    /const\s+CACHE_NAME\s*=\s*"[^"]*"\s*;/,
    `const CACHE_NAME = "${cacheName}";`
  );

  if (content === before) {
    console.error(
      `[patch-sw.js] 找不到 const CACHE_NAME 那一行。sw.js 未被修改。`
    );
    process.exit(1);
  }

  writeFileSync(SW_PATH, content, "utf8");
  console.log(`[patch-sw.js] CACHE_NAME → ${cacheName}`);
}

patchSw();
