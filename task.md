# 公測前資安與成本硬化 — 實作清單

> 依序執行。禁止跳步。每步完成後請自行驗證再進下一步。

---

## Step 1 — Firebase Config 改為環境變數（H-1）

**目標檔案**：`src/lib/firebase.ts`（替換第 10–18 行 hardcoded config block）

**變更內容**：
```ts
// 舊（第 10–18 行）：
const firebaseConfig = {
  apiKey: "AIzaSyD2yBIIUzRdwvwr_ApEYjAR4ujF-jaX4cs",
  authDomain: "taskflow-1fbd3.firebaseapp.com",
  projectId: "taskflow-1fbd3",
  storageBucket: "taskflow-1fbd3.firebasestorage.app",
  messagingSenderId: "942619428359",
  appId: "1:942619428359:web:5718c6891b624a397b8ca2",
  measurementId: "G-36ELNFZNZD",
};

// 新（替換為）：
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
```

**同步更新**：`src/lib/firebase.ts` 頂部註解說明這些 env 來自 `.env.local`（與 `.env.local.example` 對齊）

**驗證方式**：
```bash
cd /Users/liangzhiwei/Documents/VIbe\ Coding/任務管理器
npm run build 2>&1 | tail -20
# 期望：build success，無 firebase config 相關 error
```

**依賴**：無

---

## Step 2 — OmniSonic Playlist 加 auth + rate limit（H-2）

**目標檔案**：`src/app/api/omnisonic/playlist/route.ts`（全檔重寫 GET handler）

**變更內容**：
```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // 1. Auth — 從 cookie 驗證登入
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return (request as any).cookies?.getAll?.() ?? [];
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit（分散式，key = user.id）
  const { allowed } = await checkRateLimit(`omnisonic-playlist:${user.id}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited, try again in a minute" }, { status: 429 });
  }

  // 3. 原有 fetch 邏輯（不變）
  const { searchParams } = new URL(request.url);
  const omnisonicUrl =
    process.env.NEXT_PUBLIC_OMNISONIC_URL ||
    "https://music-focus-environment.vercel.app";
  const targetUrl = new URL(`${omnisonicUrl}/api/zenflow/autodj/playlist`);
  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const res = await fetch(targetUrl.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 10 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch playlist" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
```

**驗證方式**：
```bash
# curl 無 auth → 期望 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/omnisonic/playlist
# 期望輸出：401

# 登入後從瀏覽器 DevTools console：
# fetch('/api/omnisonic/playlist').then(r => r.json()).then(console.log)
# 期望：正常回傳 playlist JSON
```

**依賴**：Step 1 完成後執行（避免 build 時 env 未設定問題）

---

## Step 3 — OmniSonic Stream 改用分散式 rate limit（H-3）

**目標檔案**：`src/app/api/omnisonic/stream/[slug]/route.ts`

**變更內容**：

1. **刪除**第 17–32 行的 in-memory Map + `checkStreamRateLimit` 函式：
```ts
// 刪除這整段：
const STREAM_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const STREAM_LIMIT = 60;
const STREAM_WINDOW_MS = 60_000;

function checkStreamRateLimit(userId: string): boolean { ... }
```

2. **檔頭新增 import**：
```ts
import { checkRateLimit } from "@/lib/rate-limit";
```

3. **在 handler 內**，將 `if (!checkStreamRateLimit(user.id))` 整段（約在原第 77 行附近）**替換為**：
```ts
const { allowed } = await checkRateLimit(`omnisonic-stream:${user.id}`, 60, 60_000);
if (!allowed) {
  return NextResponse.json(
    { error: "Stream rate limit exceeded" },
    { status: 429 }
  );
}
```

**驗證方式**：
```bash
npm run build 2>&1 | grep -E "(error|warning|success)" | tail -10
# 期望：clean build，無 TS error
```

**依賴**：Step 1 完成後執行

---

## Step 4 — 舊版 `/api/calendar/feed` 移除或 301 轉址（H-4）

**目標檔案**：`src/app/api/calendar/feed/route.ts`

**先確認前端無依賴**（不可跳過）：
```bash
cd /Users/liangzhiwei/Documents/VIbe\ Coding/任務管理器
grep -rn "calendar/feed\|/api/calendar/feed\|calendarFeed\|calendar-feed" src/ --include="*.ts" --include="*.tsx" -i
# 期望：無輸出（0 個引用）
```

**若 grep 結果為空**，則**全檔刪除** `src/app/api/calendar/feed/route.ts`：
```bash
rm src/app/api/calendar/feed/route.ts
```

**驗證方式**：
```bash
npm run build 2>&1 | tail -10
# 期望：build success，無 missing module error
git status src/app/api/calendar/feed/
# 期望：無此檔案（或 git rm 後）
```

**若 grep 有輸出**：將 `GET` handler 改為：
```ts
export async function GET() {
  return NextResponse.redirect(new URL("/api/calendar/webcal", "https://www.vibelist.work"), 301);
}
```

**依賴**：無

---

## Step 5 — `/api/auth/health` 移除 FIREBASE_PRIVATE_KEY 長度洩漏（M-1）

**目標檔案**：`src/app/api/auth/health/route.ts`

**變更內容**：第 14 行
```ts
// 舊：
fbKey: process.env.FIREBASE_PRIVATE_KEY ? `✅ set (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : "❌ missing",

// 新：
fbKey: process.env.FIREBASE_PRIVATE_KEY ? "✅ set" : "❌ missing",
```

**驗證方式**：
```bash
curl -s http://localhost:3000/api/auth/health | python3 -m json.tool
# 確認 fbKey 欄位無長度數字
```

**依賴**：無

---

## Step 6 — Firestore Rules 限制 Beta 名單讀取權限（M-2）

**目標檔案**：`firestore.rules`

**變更內容**：`match /permissions/betas/emails/{email}` 區塊（約第 33 行）：
```rules
// 舊（第 33 行）：
allow read: if true;

// 新：
allow read: if isSignedIn();   // 需登入才能讀取自己的 Beta 狀態
```

完整變更後規則：
```rules
match /permissions/betas/emails/{email} {
  // 需登入才能讀（對齊前端從 auth.token.email 而非 Firestore 讀取的現況）
  allow read: if isSignedIn();
  // 只有 Admin 能新增/修改/刪除
  allow create, update, delete: if isAdmin();
  // 寫入時驗證資料結構
  allow create, update: if request.resource.data.keys().hasAll(["email", "addedAt", "addedBy"])
    && request.resource.data.email == email
    && request.resource.data.addedBy == request.auth.uid;
}
```

**驗證方式**：
```bash
# Firebase CLI 模擬（需 firebase-tools 安裝）
firebase emulators:start --only firestore
# 或直接在 Firebase Console → Firestore → Rules 上傳新 rules 並測試
```

**依賴**：無

---

## Step 7 — `/api/diag` 移除硬編碼 email，改吃 query param（M-3）

**目標檔案**：`src/app/api/diag/route.ts`

**變更內容**：

1. 第 11–12 行新增 query param 讀取：
```ts
// 在 req 解析後（req: any）新增：
const queryEmail = req.nextUrl.searchParams.get("email") ?? "";
```

2. 第 19 行（`users.users.find(...)` 那一行）：
```ts
// 舊：
const wife = users.users.find(u => u.email === 'xdstudiooffice@gmail.com');

// 新：
const target = users.users.find(u => u.email === (queryEmail || 'xdstudiooffice@gmail.com'));
```

3. 後續所有 `wife` 變數名改為 `target`

**驗證方式**：
```bash
# 有 DIAG_SECRET header + email query：
curl -s -H "x-diag-token: <DIAG_SECRET>" \
  "http://localhost:3000/api/diag?email=xdstudiooffice@gmail.com" \
  | python3 -m json.tool

# 無 email query（fallback 仍有效）：
curl -s -H "x-diag-token: <DIAG_SECRET>" \
  http://localhost:3000/api/diag \
  | python3 -m json.tool
```

**依賴**：無

---

## Step 8（可選）— 清理 `.env.local.example` 冗餘（L-1）

**目標檔案**：`.env.local.example`（已被 git 追蹤）

**變更內容**：確認與 `.env.example` 完全相同後，執行：
```bash
git rm --cached .env.local.example
# 並在 .gitignore 確認已有 .env.local.example 或 .env*
```

**驗證方式**：
```bash
git status .env.local.example
# 期望：無輸出（已移除追蹤）
```

**依賴**：Step 1 完成後執行（確保 `.env.example` 已完整涵蓋所有必要變數）

---

## 執行摘要

| Step | 檔案 | 風險 |
|------|------|------|
| 1 | `src/lib/firebase.ts` | 低（僅 env 注入） |
| 2 | `src/app/api/omnisonic/playlist/route.ts` | 低（純加法） |
| 3 | `src/app/api/omnisonic/stream/[slug]/route.ts` | 低（替換實作） |
| 4 | `src/app/api/calendar/feed/route.ts` | 中（需先 grep 確認） |
| 5 | `src/app/api/auth/health/route.ts` | 極低（一行） |
| 6 | `firestore.rules` | 低（rules 檔，需 Firebase Console 上傳） |
| 7 | `src/app/api/diag/route.ts` | 極低（一行 + 一參數） |
| 8 | `.env.local.example` | 極低（git 操作） |

完成所有 Steps 後執行一次全域 build + lint 驗證：
```bash
npm run build && npm run lint
```
