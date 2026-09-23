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

  // 3. Fetch OmniSonic Auto DJ playlist
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
