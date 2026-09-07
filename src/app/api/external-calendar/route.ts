import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/external-calendar?url=<ICS_URL>
 *
 * 後端代理(修 A1 production bug):
 * - 瀏覽器 CORS 預設禁止跨來源 GET,Google iCal endpoint 沒送
 *   Access-Control-Allow-Origin: *,所以 fetch() 直接被擋下,console 顯示
 *   「Failed to fetch」(瀏覽器把 CORS failure 包成 network error)
 * - 改走 server-side fetch,不受 CORS 限制,再以 text/calendar 內容回傳前端
 * - 前端 fetchAndCacheExternalCalendar() 自動走相對路徑 → 透過此 route
 *
 * 安全考量(§11 §25 既有防護):這個 route 是 open proxy,必須限制可呼叫的 URL,
 * 否則會被當成 SSRF / 任意檔案讀取向量。
 */

// 允許的 calendar endpoint 域名白名單(只列已知會提供 ICS 的服務)
const ALLOWED_HOSTS = new Set<string>([
  "calendar.google.com",
  "www.googleapis.com",
  // Apple iCloud 公開日曆訂閱
  "p30-calendarws.icloud.com",
  "caldav.icloud.com",
  "www.calendars.icloud.com",
  // Outlook / Microsoft 365
  "outlook.office.com",
  "outlook.live.com",
  // 其他常見日曆服務(用戶可手動新增)
  "www.bing.com",
]);

// 上限:ICS 通常 < 5MB,給 10MB 緩衝
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "缺少 url 參數" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL 格式不合法" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json(
      { error: "僅支援 http(s) 協議" },
      { status: 400 },
    );
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return NextResponse.json(
      {
        error: `不允許的域名:${parsed.hostname}(請聯絡管理員加入白名單或使用支援的日曆服務)`,
      },
      { status: 403 },
    );
  }

  // 阻斷指向內網 / loopback 的 SSRF
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.")
  ) {
    return NextResponse.json(
      { error: "不允許指向內網位址" },
      { status: 403 },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        Accept:
          "text/calendar,text/plain;q=0.9,application/octet-stream;q=0.8,*/*;q=0.5",
        "User-Agent": "VibeList/1.0 (+https://vibelist.app)",
      },
      // 不帶 cookies,因為 ICS 私人 URL 自帶 token
      credentials: "omit",
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `上游 HTTP ${upstream.status}` },
        { status: 502 },
      );
    }

    // Content-Length 預檢(若上游有送)
    const contentLength = upstream.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      return NextResponse.json(
        { error: `回應過大:${contentLength} bytes(上限 ${MAX_RESPONSE_BYTES})` },
        { status: 413 },
      );
    }

    const text = await upstream.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json(
        { error: `回應超過 ${MAX_RESPONSE_BYTES} bytes` },
        { status: 413 },
      );
    }

    // Content-Type 透傳上游(若無則預設 text/calendar)
    const upstreamCt = upstream.headers.get("content-type");
    const contentType = upstreamCt ?? "text/calendar; charset=utf-8";

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, max-age=0",
        "X-Proxy-Source": parsed.hostname,
      },
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { error: isAbort ? `請求逾時(${FETCH_TIMEOUT_MS / 1000}s)` : `代理失敗:${(e as Error).message}` },
      { status: isAbort ? 504 : 502 },
    );
  }
}
