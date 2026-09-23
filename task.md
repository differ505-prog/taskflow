# 安全修復實作清單

## 前置條件

- Node.js 18+
- Vercel CLI 已登入
- `.env.local` 有完整的開發環境變數

---

## Step 1：修復 `/api/invite/send` in-memory Rate Limit

**檔案：** `src/app/api/invite/send/route.ts`

**變更：**

1. **移除**第 47-61 行的 in-memory Map 實作：
   ```typescript
   // 移除這段：
   const inviteRequestCounts = new Map<string, { count: number; resetAt: number }>();
   const INVITE_RATE_LIMIT = 20;
   const INVITE_RATE_WINDOW_MS = 60 * 60 * 1000;

   function checkInviteRateLimit(ip: string): boolean {
     const now = Date.now();
     const entry = inviteRequestCounts.get(ip);
     if (!entry || now > entry.resetAt) {
       inviteRequestCounts.set(ip, { count: 1, resetAt: now + INVITE_RATE_WINDOW_MS });
       return true;
     }
     if (entry.count >= INVITE_RATE_LIMIT) return false;
     entry.count++;
     return true;
   }
   ```

2. **新增** import：
   ```typescript
   import { checkRateLimit } from "@/lib/rate-limit";
   ```

3. **替換**第 72 行的 rate limit 檢查：
   ```typescript
   // 原本：
   const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
   if (!checkInviteRateLimit(ip)) {
     return NextResponse.json({ error: "太多次數,請稍後再試" }, { status: 429 });
   }
   // 改為：
   const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
   const { allowed } = await checkRateLimit(`invite:ip:${ip}`, 20, 60 * 60 * 1000);
   if (!allowed) {
     return NextResponse.json({ error: "太多次數,請稍後再試" }, { status: 429 });
   }
   ```

**依賴：** 此步驟無前置依賴，可最先執行。

**驗證：** `npm run build` 成功，且 `/api/invite/send` 在高並發請求下觸發 429。

---

## Step 2：設定 `DIAG_SECRET` 環境變數

**檔案：** `.env.local.example`

**變更：** 在檔案末尾新增：
```bash
# ─── Admin Diag ───────────────────────────────────────────────────────────
# 管理員診斷端點金鑰（任意隨機字串，長度 >= 32）
DIAG_SECRET=
```

**檔案：** `.env.local`

**變更：** 填入隨機值（32 字元以上）：
```bash
DIAG_SECRET=your-random-32-char-secret-here
```

**檔案：** `src/app/api/diag/route.ts`

**變更：** 第 6 行維持不變（已正確比對 `process.env.DIAG_SECRET`）：
```typescript
const diagToken = req.headers.get('x-diag-token');
if (diagToken !== process.env.DIAG_SECRET) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**依賴：** 此步驟無程式碼依賴，但需在部署前於 Vercel 環境變數設定 `DIAG_SECRET`。

**驗證：** `npm run build` 成功，且向 `/api/diag` 發送錯誤的 `x-diag-token` header 時返回 403。

---

## Step 3：清理 `.env.local` 中的 VAPID 公鑰

**檔案：** `.env.local.example`

**變更：** 將 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 的值替換為 placeholder：
```bash
# 原本：
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEGIwtReUeUUWsreqpsPKeuNw53ylHxUleF6sF4j5DgICL21jKz1TZ693ShTeAfT5dNVNtumq2193VpNyI-Ei-0
# 改為：
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
```

**⚠️ 額外動作（需手動執行，非 CI 可自動化）：**

執行 `git filter-branch` 清除已 commit 的 `.env.local`：
```bash
cd "/Users/liangzhiwei/Documents/VIbe Coding/任務管理器"
git filter-branch --tree-filter 'rm -f .env.local' HEAD --force
git push --force
```

**依賴：** 此步驟在 `.env.local.example` 修改之後執行。

**驗證：** `git log --follow .env.local` 無輸出，`.env.local` 不存在於任何 commit。

---

## Step 4：`invite/send` Email 長度限制

**檔案：** `src/app/api/invite/send/route.ts`

**變更：** 在第 69-75 行 email regex 驗證後新增長度檢查：
```typescript
// 在 emailRegex 驗證後（第 75 行之後）新增：
if (inviteeEmail.length > 254) {
  return NextResponse.json({ error: "Email address too long" }, { status: 400 });
}
```

**依賴：** 無。獨立修改。

**驗證：** `npm run build` 成功。POST body 傳入 255 字元的 email 時返回 400。

---

## Step 5：`feedback` route 改查 DB 取得 userRole

**檔案：** `src/app/api/feedback/route.ts`

**變更：**

1. **移除**對 `body.userRole` 的直接信任（第 36 行）：
   ```typescript
   // 原本：
   const { message, userRole, context } = body ?? {};
   // 改為：
   const { message, context } = body ?? {};
   ```

2. **在**取得 `userId` 之後（第 67 行之後），新增 DB 查詢：
   ```typescript
   // 2.5. 從 DB 取得真實 userRole（不再信任 client body）
   let userRole = "free";
   const serviceClient = getServiceClient();
   if (serviceClient && userId) {
     const { data: profile } = await serviceClient
       .from("user_profiles")
       .select("role")
       .eq("uid", userId)
       .single();
     userRole = profile?.role ?? "free";
   }
   ```

3. **更新**第 73 行的 `insertPayload`（移除 body 中的 userRole）：
   ```typescript
   // 原本：
   const insertPayload = {
     user_id: userId,
     user_email: userEmail ?? null,
     user_role: userRole ?? "free",
     message: message.slice(0, 2000),
     context: context ?? {},
   };
   // 改為（userRole 已從 DB 取得）：
   const insertPayload = {
     user_id: userId,
     user_email: userEmail ?? null,
     user_role: userRole,
     message: message.slice(0, 2000),
     context: context ?? {},
   };
   ```

**依賴：** 無。

**驗證：** `npm run build` 成功。POST 任意 userRole 值時，寫入 `feedback` 表的 `user_role` 欄位應為 DB 中 `user_profiles.role` 的真實值。

---

## Step 6：Gemini API Key 未設定時增加 Sentry 告警

**檔案：** `src/app/api/shred/route.ts`

**變更：** 第 98-100 行改為：
```typescript
if (!apiKey) {
  console.error("[api/shred] GEMINI_API_KEY not configured");
  // 主動通知 Discord（利用既有 quota-monitor warnDiscord 機制）
  if (process.env.DISCORD_WEBHOOK_URL_FOR_QUOTA) {
    await fetch(process.env.DISCORD_WEBHOOK_URL_FOR_QUOTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "🚨 **[TaskFlow]** GEMINI_API_KEY 未設定，AI 任務粉碎機已停用",
      }),
    }).catch(() => {});
  }
  return NextResponse.json(
    { error: "AI 服務尚未設定,請聯繫管理員" },
    { status: 503 }
  );
}
```

**依賴：** 需在 `.env.local` 設定 `DISCORD_WEBHOOK_URL_FOR_QUOTA`。

**驗證：** 移除 `GEMINI_API_KEY` 後，`npm run dev` 並 POST `/api/shred`，Discord 收到告警。

---

## Step 7：`webcal` route 增加分頁 cursor 機制

**檔案：** `src/app/api/calendar/webcal/route.ts`

**變更：**

1. **GET 參數新增** `cursor` 支援（`limit` 固定 500）：
   ```typescript
   // 第 97 行附近（tasks query 前）新增：
   const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
   // 查詢時附加 .gte("updatedAt", cursor) 邏輯（需配合 cursor 為 updatedAt 值）
   ```

2. **tasks query 改為**：
   ```typescript
   const { data: tasks, error: tasksError } = await supabase
     .from("personal_tasks")
     .select("*")
     .eq("uid", user.id)
     .order("updatedAt", { ascending: false })
     .lte("updatedAt", cursor)
     .limit(500);
   ```

3. **response headers 新增** `X-Next-Cursor`（最後一筆的 `updatedAt`）：
   ```typescript
   return new NextResponse(ics, {
     headers: {
       "Content-Type": "text/calendar; charset=utf-8",
       "Content-Disposition": "inline; filename=\"vibelist.ics\"",
       "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
       "X-Next-Cursor": lastTask?.updatedAt ?? "",
     },
   });
   ```

**依賴：** 無。

**驗證：** 個人任務 > 500 筆時，`curl -I /api/calendar/webcal` 回應頭有 `X-Next-Cursor`，攜帶 cursor 再請求可取得下一批。

---

## Step 8：`external-calendar` 支援 `webcal://` Protocol

**檔案：** `src/app/api/external-calendar/route.ts`

**變更：** 第 27-34 行 `ALLOWED_HOSTS` 之前新增 protocol 轉換邏輯：
```typescript
// 在 function GET 內、ALLOWED_HOSTS 定義之後（約第 54 行附近）新增：
const ALLOWED_HOSTS = new Set<string>([...]);

// 處理 webcal:// → https:// 轉換（蘋果日曆用戶常見）
let url = request.nextUrl.searchParams.get("url");
if (url?.startsWith("webcal://")) {
  url = url.replace("webcal://", "https://");
}
```

並將後續 `parsed.protocol !== "https:"` 改為：
```typescript
if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
```

**依賴：** 無。

**驗證：** `GET /api/external-calendar?url=webcal://p30-calendarws.icloud.com/xxx.ics` 返回 200 且含 ICS 內容。

---

## Step 9：確保 Supabase Migration 0026 已部署

**檔案：** `supabase/migrations/0026_rate_limit_buckets.sql`

**驗證方式：**

在 Supabase Dashboard → SQL Editor 執行：
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines
  WHERE routine_name = 'rate_limit_increment'
);
-- 應返回 t (true)
```

若返回 `f`，手動執行 migration：
```bash
npx supabase db push
# 或在 Supabase Dashboard 的 Migration 頁手動執行 SQL
```

**依賴：** Step 1 的 `/api/invite/send` 修改依賴此 migration。

**驗證：** 觸發 rate limit 時，`rate_limit_buckets` 表有記錄。

---

## Step 10：Rate Limit fail-open 改為 fail-closed（可選，謹慎評估）

**檔案：** `src/lib/rate-limit.ts`

**說明：** 此為架構決策。若希望 DB 異常時阻斷請求（犧牲可用性換取安全性），將第 65 行附近的 fail-open 改為：
```typescript
// 原本：
} catch {
  // DB 錯誤 → fail-open
  return { allowed: true, remaining: limit, resetAt };
}
// 改為：
} catch {
  // DB 錯誤 → fail-closed（安全優先）
  return { allowed: false, remaining: 0, resetAt: now + windowMs };
}
```

**依賴：** 無。

**驗證：** 人為造成 DB 無法連線時，所有 rate-limit 端點返回 429。

---

## 執行順序

| 順序 | Step | 備註 |
|------|------|------|
| 1 | Step 1 | 最高優先（invite/send rate limit 漏洞） |
| 2 | Step 9 | 確認 migration 已部署（Step 1 的前提） |
| 3 | Step 2 | 需配合 Vercel 環境變數設定 |
| 4 | Step 3 | 需 force push，協作者需同步 |
| 5 | Step 4 | 獨立，簡單 |
| 6 | Step 5 | 獨立 |
| 7 | Step 6 | 需設定 DISCORD_WEBHOOK_URL_FOR_QUOTA |
| 8 | Step 7 | 需前端配合 cursor 參數傳遞 |
| 9 | Step 8 | 需測試蘋果日曆用戶流程 |
| 10 | Step 9 | 驗證 migration |
| 11 | Step 10 | 可選，影響全站 API 可用性 |
