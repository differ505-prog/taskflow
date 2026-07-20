/**
 * /auth/callback — Supabase OAuth redirect handler
 *
 * 當 Google OAuth 登入完成後，Supabase 會 redirect 回這個路由。
 * @supabase/ssr createBrowserClient 會自動處理 cookie 寫入，
 * 我們只需要 redirect 回首頁。
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");

  if (code) {
    const target = type === "recovery" ? "/reset-password" : "/";
    const supabaseResponse = NextResponse.redirect(new URL(target, req.url));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
    return supabaseResponse;
  }

  url.pathname = "/";
  return NextResponse.redirect(url);
}
