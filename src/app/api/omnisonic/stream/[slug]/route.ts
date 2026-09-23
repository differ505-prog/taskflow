import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * §Stream proxy — 解決 OmniSonic CORS 只放行 taskflow-v2-pink domain
 *
 * 根因:music-focus-environment.vercel.app 的 /api/zenflow/stream/* 對
 * `access-control-allow-origin: https://taskflow-v2-pink.vercel.app` only,
 * 其他 domain(www.vibelist.work 等)直接 fetch 會被 CORS 拒,
 * WebAudio decodeAudioData 與 <audio> element 載入都會 silently fail。
 *
 * 解法:Next.js 同源 proxy — 前端請求自己的 /api/omnisonic/stream/[slug],
 * server-side fetch 到 OmniSonic,stream binary body 直接 pipe 回前端,
 * 無 CORS 問題。Range header 也代為轉發,支援 seek 跳播。
 *
 * 硬化（§8）：
 *   - 強制登入：無有效 Supabase session → 401
 *   - Rate limit：每 user 每分鐘 60 次（分散式，Supabase-backed）
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const req = request as unknown as Request & { headers: Headers; cookies: { getAll: () => { name: string; value: string }[] } };
    const { slug } = await params;

    // 1. 驗證登入（從 cookie 讀取 Supabase session）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return (request as unknown as { headers: Headers; cookies: { getAll: () => { name: string; value: string }[] } }).cookies?.getAll?.() ?? [];
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limit（分散式，Supabase-backed）
    const { allowed } = await checkRateLimit(`omnisonic-stream:${user.id}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Stream rate limit exceeded" },
        { status: 429 }
      );
    }

    const omnisonicUrl =
      process.env.NEXT_PUBLIC_OMNISONIC_URL ||
      "https://music-focus-environment.vercel.app";

    const range = request.headers.get("range");

    const upstreamHeaders: HeadersInit = {
      Accept: "audio/mpeg, audio/*",
    };
    if (range) upstreamHeaders["Range"] = range;

    const res = await fetch(
      `${omnisonicUrl}/api/zenflow/stream/${encodeURIComponent(slug)}`,
      { headers: upstreamHeaders, cache: "no-store" },
    );

    if (!res.ok && res.status !== 206) {
      return NextResponse.json(
        { error: "Failed to fetch stream" },
        { status: res.status },
      );
    }

    // 透傳必要 header;status 206 partial 也要透傳
    const out = new NextResponse(res.body, {
      status: res.status,
      headers: {
        "Content-Type":
          res.headers.get("Content-Type") || "audio/mpeg",
        "Content-Length":
          res.headers.get("Content-Length") || "",
        "Accept-Ranges": "bytes",
        "Content-Range": res.headers.get("Content-Range") || "",
        "Cache-Control": "public, max-age=3600",
      },
    });
    return out;
  } catch (error) {
    console.error("OmniSonic Stream Proxy Error:", error);
    return NextResponse.json(
      { error: "Stream proxy failed" },
      { status: 500 },
    );
  }
}
