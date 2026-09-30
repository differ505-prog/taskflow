# TaskFlow 資安硬化實作清單

> 日期：2026-09-30
> 依據：資安 / 成本審計報告（2026-09-30）
> 優先順序：🟠 中 → 🟡 低 → ⚪ 極低
> 操作防線：本清單所有修改需逐一測試，`tsc --noEmit` + `npm run build` 均成功後才算完成

---

## 前置檢查清單（每次動手前確認）

- [ ] `git status` 確認無未 commit 變更（避免與其他工作衝突）
- [ ] `npm run build` 確認乾淨 build 基線（0 errors）
- [ ] `npx tsc --noEmit` 確認 0 type errors
- [ ] 備份相關檔案（或確認 git commit 已完成）

---

## 修 1 🟠｜表單加 Cloudflare Turnstile（優先級：高）

**修補目標**：`/api/waitlist` + `/api/feedback` 兩個公開表單，阻止 bot 無限提交

### Step 1.1｜申請 Turnstile 站台金鑰

1. 前往 https://dash.cloudflare.com → 搜尋 "Turnstile"
2. 新增站台：網域填 `vibelist.work`（含 `www.`、`taskflow-v2-pink.vercel.app` 等正式域名）
3. 選擇 Widget 模式：**非互動式（Non-interactive）**（使用者看不見，只在背景驗證）
4. 複製 `Site Key` 與 `Secret Key`

### Step 1.2｜加入 Vercel 環境變數

在 Vercel Project → Environment Variables 加入：

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0xxxxxxxxxxxxxxxxxxxxx`（你的 site key） | All |
| `TURNSTILE_SECRET_KEY` | `0xxxxxxxxxxxxxxxxxxxxx`（你的 secret key） | Production / Preview |
| `TURNSTILE_SECRET_KEY` | `1.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`（測試 key：`1x0000000000000000000000000000AA`） | Development |

### Step 1.3｜前端 Waitlist 頁面加 Turnstile widget

**檔案**：`src/app/waitlist/page.tsx`（或 `src/components/WaitlistForm.tsx`，找實際檔名）

在 `<form onSubmit={...}>` 內、在 `<button type="submit">` 之前加入：

```tsx
import { useEffect, useRef, useState } from "react";

export default function WaitlistPage() {
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 只在 client-side 載入
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        window.turnstile.render(turnstileRef.current!, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
          callback: (token: string) => setTurnstileToken(token),
          "error-callback": () => setTurnstileToken(""),
          theme: "light",
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      if (window.turnstile) window.turnstile.remove();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      alert("驗證中，請稍候");
      return;
    }
    // ... 原有 submit 邏輯，改為傳入 turnstileToken
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, cfTurnstile: turnstileToken }),
    });
    // ...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* email input ... */}
      <div ref={turnstileRef} data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      <button type="submit" disabled={!turnstileToken}>報名</button>
    </form>
  );
}
```

**加上 TypeScript 全域型別**（避免 TS error）：

在 `src/types/global.d.ts` 或現有型別檔案加：

```ts
interface Window {
  turnstile?: {
    render(container: HTMLElement, options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    }): string;
    remove(widgetId?: string): void;
  };
}
```

### Step 1.4｜後端 `/api/waitlist` 加 Turnstile 驗證

**檔案**：`src/app/api/waitlist/route.ts`

在 rate limit 通過後、解析 email 之前加入：

```ts
// 解析 Turnstile token
const cfTurnstile = body.cfTurnstile;
if (typeof cfTurnstile !== "string" || !cfTurnstile) {
  return NextResponse.json({ error: "請先完成人機驗證" }, { status: 403 });
}

// 呼叫 Cloudflare Turnstile 驗證 API
const verified = await fetch(
  "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: cfTurnstile,
      remoteip: ip,
    }),
  }
).then(r => r.json());

if (!verified.success) {
  console.warn("[waitlist] Turnstile verify failed:", verified["error-codes"]);
  return NextResponse.json({ error: "人機驗證失敗，請稍後重試" }, { status: 403 });
}
```

完整 `route.ts` 頂部 import 和 schema 區域：

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPabase_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // 1. Rate limit
    const { allowed } = await checkRateLimit(`waitlist:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "報名過於頻繁，請稍後再試" }, { status: 429 });
    }

    const body = await req.json();

    // 2. Turnstile 驗證（新增）
    const cfTurnstile = body.cfTurnstile;
    if (typeof cfTurnstile !== "string" || !cfTurnstile) {
      return NextResponse.json({ error: "請先完成人機驗證" }, { status: 403 });
    }
    const verified = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY!,
          response: cfTurnstile,
          remoteip: ip,
        }),
      }
    ).then(r => r.json());
    if (!verified.success) {
      console.warn("[waitlist] Turnstile failed:", verified["error-codes"]);
      return NextResponse.json({ error: "人機驗證失敗" }, { status: 403 });
    }

    // 3. Email 解析與驗證（既有邏輯保持不變）
    const rawEmail = body.email;
    // ...（其餘邏輯不變）

  } catch (err) {
    console.error("[waitlist] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Step 1.5｜後端 `/api/feedback` 加 Turnstile 驗證

**檔案**：`src/app/api/feedback/route.ts`

在 rate limit 通過後、解析 body 之前加入相同的 Turnstile 驗證邏輯：

```ts
// 在 rate limit check 之後、body 解析之前加：
const cfTurnstile = body.cfTurnstile;
if (typeof cfTurnstile !== "string" || !cfTurnstile) {
  return NextResponse.json({ error: "請先完成人機驗證" }, { status: 403 });
}
const verified = await fetch(
  "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: cfTurnstile,
      remoteip: ip,
    }),
  }
).then(r => r.json());
if (!verified.success) {
  return NextResponse.json({ error: "人機驗證失敗" }, { status: 403 });
}
```

**同步更新前端 feedback 呼叫**：找到所有呼叫 `/api/feedback` 的前端程式碼（通常是 `useFeedback` 或 FeedbackModal 元件），在 POST body 中加上 `cfTurnstile: turnstileToken`。

### Step 1.6｜驗證

```bash
npm run build
# 預期：build success
npx tsc --noEmit
# 預期：0 errors
```

手動測試：
1. 關閉瀏覽器 JS → 嘗試直接 POST `/api/waitlist` → 應回 403
2. Turnstile widget 不出現時 → submit 按鈕 disabled

---

## 修 2 🟠｜API body 加 Zod 上限（優先級：高）

**修補目標**：`/api/discord/notify`、`/api/push/send`、`/api/event-log` 三個路由，防止大 payload DoS

### Step 2.1｜`/api/discord/notify` 加 Zod schema

**檔案**：`src/app/api/discord/notify/route.ts`

在 import 區段之後加入：

```ts
import { z } from "zod";

const DiscordNotifyInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("new_user"),
    provider: z.string().max(50).optional(),
  }),
  z.object({
    type: z.literal("first_task_done"),
    taskTitle: z.string().min(1).max(200),
    userCount: z.number().int().min(0).max(1_000_000).optional(),
  }),
]);
```

在 `const body = await req.json();` 之後，將整個 switch 區塊改為：

```ts
const parsed = DiscordNotifyInput.safeParse(body);
if (!parsed.success) {
  console.warn("[discord/notify] Invalid body:", parsed.error.issues);
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

// parsed.data 的類型已被 Zod 推斷，不信任 body 的任何欄位
const { type, taskTitle, userCount } = parsed.data;
```

### Step 2.2｜`/api/push/send` 加 Zod schema

**檔案**：`src/app/api/push/send/route.ts`

在 import 區段加：

```ts
import { z } from "zod";
```

在 `const body = (await request.json()) as SendBody;` 之前加：

```ts
const PushSendInput = z.object({
  owner_uid: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  url: z.string().url().max(500).optional(),
  task_id: z.string().max(100).optional(),
});

const parsedBody = PushSendInput.safeParse(await request.json());
if (!parsedBody.success) {
  return NextResponse.json(
    { error: "Invalid request body", detail: parsedBody.error.issues },
    { status: 400 }
  );
}
const body = parsedBody.data;
```

移除頂部的 `interface SendBody { ... }`，因為 Zod type 可直接取代。

### Step 2.3｜`/api/event-log` 加 metadata 上限

**檔案**：`src/app/api/event-log/route.ts`

在 `interface EventPayload { ... }` 之後加 Zod schema：

```ts
import { z } from "zod";

const EventLogInput = z.object({
  event: z.string().min(1).max(100),
  buttonId: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (data) => JSON.stringify(data.metadata ?? {}).length < 5000,
  { message: "metadata 不可超過 5KB" }
);

const ALLOWED_EVENTS = new Set([
  "click_ghost_button_timebar",
  "click_ghost_button_unlimited_shred",
  "click_ghost_button_ai_summary",
  "click_ghost_button_karma_mode",
  "click_ghost_button_domino_tasks",
  "feedback_submitted",
  "upgrade_modal_viewed",
  "painted_door_clicked",
]);
```

將 `POST` handler 的 body 解析改為：

```ts
const parsed = EventLogInput.safeParse(await req.json());
if (!parsed.success) {
  // 格式錯誤 → 靜默回 200（設計如此，不外洩細節）
  return NextResponse.json({ success: false }, { status: 200 });
}

const body = parsed.data;

// 白名單檢查（使用 body.event，類型已由 Zod 推斷）
if (!ALLOWED_EVENTS.has(body.event)) {
  return NextResponse.json({ success: false }, { status: 200 });
}
```

移除原有的手動欄位類型檢查與 `ALLOWED_EVENTS` 前後重複定義。

### Step 2.4｜驗證

```bash
npm run build
npx tsc --noEmit
```

手動測試：
```bash
# 應回 400
curl -X POST http://localhost:3000/api/event-log \
  -H "Content-Type: application/json" \
  -d '{"event":"test","metadata":{"x":"'$(python3 -c "print('a'*6000)")'"}}'

# 應回 400
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{"owner_uid":"550e8400-e29b-41d4-a716-446655440000","title":"A","body":"'$(
    python3 -c "print('B'*3000)"
  )'"}'
```

---

## 修 3 🟡｜Cron `?secret=` 在 production 關閉（優先級：中）

**修補目標**：`/api/cron/task-reminders` 與 `/api/email/cs`，消除 query string 洩漏到 log 的風險

### Step 3.1｜`/api/cron/task-reminders` 移除 production query secret

**檔案**：`src/app/api/cron/task-reminders/route.ts`

找到此段落（約 line 30-43）：

```ts
// 原本：
if (process.env.NODE_ENV === "production") {
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (
    bearerToken !== expected &&
    querySecret !== expected &&
    headerSecret !== expected
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

**改為**：

```ts
if (process.env.NODE_ENV === "production") {
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  // production 只接受 Bearer header（Vercel Cron 標準注入方式）
  // 與 x-cron-secret header（手動觸發備援）
  // 移除 querySecret !== expected，避免 ?secret= 在 log/CDN/瀏覽器歷史留下
  if (bearerToken !== expected && headerSecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

### Step 3.2｜`/api/email/cs` 移除 production query secret

**檔案**：`src/app/api/email/cs/route.ts`

找到此段落（約 line 75-82）：

```ts
// 原本：
if (
  process.env.NODE_ENV === "production" &&
  bearerToken !== CRON_SECRET &&
  querySecret !== CRON_SECRET &&
  headerSecret !== CRON_SECRET
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**改為**：

```ts
if (
  process.env.NODE_ENV === "production" &&
  bearerToken !== CRON_SECRET &&
  headerSecret !== CRON_SECRET
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

在同檔案上方的 `vercel.json` 與註解可以同步更新：

```ts
// 原本註解：
// Vercel Cron 自動注入 Authorization Bearer header；
// query string ?secret= 與 x-cron-secret header 留作 manual trigger 備援

// 改為：
// Vercel Cron 自動注入 Authorization Bearer header；
// x-cron-secret header 留作 manual trigger 備援
```

### Step 3.3｜dev / preview 保留 query 通道（不刪）

dev 環境與 preview branch 仍需支援 `?secret=`，因此在 production check 外包 else：

```ts
if (process.env.NODE_ENV === "production") {
  // production 邏輯（見 Step 3.1 / 3.2）
} else {
  // dev / preview：支援 Bearer + query + header 三通道
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (
    bearerToken !== expected &&
    querySecret !== expected &&
    headerSecret !== expected
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

### Step 3.4｜驗證

```bash
npm run build
npx tsc --noEmit
```

本地測試：
```bash
# 必須用 Bearer 或 x-cron-secret header，?secret= 在 production 應失效
# 若本機 NODE_ENV=development，仍支援三通道
```

---

## 修 4 🟡｜`/api/invite/send` 改 Zod（優先級：中）

**修補目標**：統一所有 API 路由的輸入驗證方式，消除手寫 regex 遺漏風險

### Step 4.1｜加入 Zod schema

**檔案**：`src/app/api/invite/send/route.ts`

在 import 區段加：

```ts
import { z } from "zod";
```

在 POST handler 頂部、rate limit 之後加：

```ts
const InviteSendInput = z.object({
  sharedListId: z.string().uuid({ message: "sharedListId 必須是有效的 UUID" }),
  inviteeEmail: z
    .string()
    .email({ message: "請輸入有效的 Email" })
    .max(254)
    .transform((s) => s.toLowerCase()),
  role: z.enum(["editor", "viewer"], { message: "role 只能是 editor 或 viewer" }),
});

const parsed = InviteSendInput.safeParse(body);
if (!parsed.success) {
  const issues = parsed.error.issues;
  const firstMsg = issues[0]?.message ?? "格式錯誤";
  return NextResponse.json(
    { error: firstMsg, detail: issues },
    { status: 400 }
  );
}

const { sharedListId, inviteeEmail, role } = parsed.data;
// 移除原本的：const { sharedListId, inviteeEmail, role } = body;
// 移除原本的：手動 email regex + length 檢查 + role includes 檢查
```

### Step 4.2｜驗證

```bash
npm run build
npx tsc --noEmit
```

手動測試：
```bash
# 正常
curl -X POST http://localhost:3000/api/invite/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sharedListId":"550e8400-e29b-41d4-a716-446655440000","inviteeEmail":"test@example.com","role":"editor"}'

# 應回 400（invalid UUID）
curl -X POST http://localhost:3000/api/invite/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sharedListId":"not-a-uuid","inviteeEmail":"test@example.com","role":"editor"}'

# 應回 400（invalid role）
curl -X POST http://localhost:3000/api/invite/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sharedListId":"550e8400-e29b-41d4-a716-446655440000","inviteeEmail":"test@example.com","role":"admin"}'
```

---

## 修 5 🟡｜DIAG_SECRET 長度強制檢查（優先級：中）

**修補目標**：deploy 時阻擋弱 secret，避免診斷端點被暴力枚舉

### Step 5.1｜建立 `src/lib/assert-env.ts`

**新建檔案**：`src/lib/assert-env.ts`

```ts
/**
 * 部署時環境變數強制檢查
 * 在 Next.js build 階段（ISR / edge function warm-up）觸發。
 * 若檢查失敗，throw → Vercel build fail（需修補後重新 deploy）。
 *
 * 這些檢查只針對「若缺則整站功能直接壞掉」的變數，
 * 不是每個 .env.local 變數都檢查。
 */

/** 管理員診斷金鑰：>= 32 字元，防止暴力枚舉 */
function assertDiagSecret() {
  const s = process.env.DIAG_SECRET;
  if (!s) {
    throw new Error("[assert-env] DIAG_SECRET is not set. Required >= 32 chars.");
  }
  if (s.length < 32) {
    throw new Error(
      `[assert-env] DIAG_SECRET too short (${s.length} chars). Minimum 32 chars required.`
    );
  }
  // 不允許空白字元
  if (s.includes(" ")) {
    throw new Error("[assert-env] DIAG_SECRET contains whitespace characters.");
  }
}

/** Cron Secret：用於 Vercel Cron job 認證 */
function assertCronSecret() {
  const s = process.env.CRON_SECRET;
  if (!s) {
    throw new Error("[assert-env] CRON_SECRET is not set in production.");
  }
  if (s.length < 32) {
    throw new Error(
      `[assert-env] CRON_SECRET too short (${s.length} chars). Minimum 32 chars required.`
    );
  }
}

/** 觸發檢查（在 module load 時執行）*/
export function runEnvAssertions() {
  if (process.env.NODE_ENV !== "production") return;

  try {
    assertDiagSecret();
    assertCronSecret();
  } catch (err) {
    console.error("[assert-env] Production env validation failed:", err);
    // throw 才會讓 build / deploy 失敗
    throw err;
  }
}
```

### Step 5.2｜在 `instrumentation.ts` 觸發檢查

**檔案**：`instrumentation.ts`

在 `register()` 函式內加：

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  // 新增：Production 環境變數強制檢查
  if (process.env.NODE_ENV === "production") {
    const { runEnvAssertions } = await import("./lib/assert-env");
    runEnvAssertions();
  }
}
```

### Step 5.3｜產生合格的 CRON_SECRET

```bash
# 產生 48 字元隨機 secret
openssl rand -base64 48
# 複製輸出，貼到 Vercel CRON_SECRET 環境變數
```

```bash
# 或用 node
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Step 5.4｜驗證

```bash
# 確認本機 build 不 throw（dev 不觸發）
npm run build
# 預期：build success

# 手動測試 assert-env.ts
node -e "
process.env.NODE_ENV = 'production';
process.env.DIAG_SECRET = 'short';
try { require('./src/lib/assert-env').runEnvAssertions(); }
catch(e) { console.log('PASS: caught', e.message); }
"

node -e "
process.env.NODE_ENV = 'production';
process.env.DIAG_SECRET = 'a'.repeat(32);
process.env.CRON_SECRET = 'b'.repeat(32);
try { require('./src/lib/assert-env').runEnvAssertions(); console.log('PASS: no throw'); }
catch(e) { console.log('FAIL:', e.message); }
"
```

---

## 修 6 ⚪｜CSP report-uri 預留（優先級：低，可最後做）

**修補目標**：在 CSP header 加入 `report-uri`，蒐集 XSS 嘗試失敗時的 client-side 報告

### Step 6.1｜建立 CSP 舉報端點

**新建檔案**：`src/app/api/csp-report/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 只 log，不做任何處理；日誌送 Sentry
    console.warn("[CSP Violation]", JSON.stringify(body));

    // 可選：送 Sentry
    // const Sentry = await import("@sentry/nextjs");
    // Sentry.captureMessage("[CSP] " + JSON.stringify(body), "warning");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

### Step 6.2｜在 next.config.mjs 的 CSP 加入 report-uri

**檔案**：`next.config.mjs`

在 CSP string 的 `"frame-ancestors 'none'"` 之後加：

```ts
// frame-ancestors 'none' 之後
"report-uri /api/csp-report",
```

完整 CSP connect-src 同步更新（若尚未允許）：
```ts
// connect-src 已有 https://*.sentry.io，report-uri 是同源所以不需加
```

---

## 完整依賴順序圖

```
修 1（Turnstile）────┬─→ Step 1.2（env vars）──→ Step 1.3（前端）──→ Step 1.4（waitlist API）──→ Step 1.5（feedback API）──→ Step 1.6（驗證）
                     └─（env vars 可獨立先做）

修 2（Zod 上限）────┬─→ Step 2.1（discord/notify）──→ Step 2.4（驗證）
                    ├─→ Step 2.2（push/send）
                    └─→ Step 2.3（event-log）

修 3（Cron secret）──┬─→ Step 3.1（task-reminders）──→ Step 3.3（dev 分支）──→ Step 3.4（驗證）
                      └─→ Step 3.2（email/cs）

修 4（invite Zod）───────→ Step 4.1──→ Step 4.2（驗證）

修 5（assert-env）──┬─→ Step 5.1（新建 assert-env.ts）
                    ├─→ Step 5.2（instrumentation.ts）
                    ├─→ Step 5.3（產生 secret）
                    └─→ Step 5.4（驗證）

修 6（CSP report）───────→ Step 6.1──→ Step 6.2──→ npm run build
```

---

## 最終驗收標準

| 項目 | 預期結果 |
|---|---|
| `npm run build` | build success |
| `npx tsc --noEmit` | 0 errors |
| `/api/waitlist` POST 無 Turnstile token | 403 |
| `/api/event-log` metadata > 5KB | 200（但靜默 success: false） |
| `/api/push/send` body > 2000 字 | 400 |
| `/api/cron/task-reminders` production `?secret=` | 401 Unauthorized |
| `DIAG_SECRET` < 32 字元時 build | throw（build fail） |

---

## 部署後確認清單（Deploy 後執行）

- [ ] Vercel dashboard → Environment Variables 確認 `TURNSTILE_SECRET_KEY` 已設定（Production）
- [ ] Vercel dashboard → Environment Variables 確認 `CRON_SECRET` >= 32 字元
- [ ] Vercel dashboard → Environment Variables 確認 `DIAG_SECRET` >= 32 字元
- [ ] 本地 build 後 deploy preview，確認 `/api/csp-report` 回 200
- [ ] 登入 Cloudflare Turnstile dashboard，確認 widget 有被呼叫（看見驗證記錄）
- [ ] Production 環境直接 POST `/api/waitlist`（無瀏覽器），確認 403
