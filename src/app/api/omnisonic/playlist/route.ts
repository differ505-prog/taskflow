import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const omnisonicUrl = process.env.NEXT_PUBLIC_OMNISONIC_URL || "https://music-focus-environment.vercel.app";
    
    // Construct target URL
    const targetUrl = new URL(`${omnisonicUrl}/api/zenflow/autodj/playlist`);
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const res = await fetch(targetUrl.toString(), {
      headers: {
        "Accept": "application/json",
      },
      next: { revalidate: 10 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch playlist" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("OmniSonic Proxy Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
