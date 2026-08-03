/**
 * Supabase Auth Middleware
 *
 * 功能：
 * - 在每個請求前，自動用 cookie 中的 Supabase session 刷新 access_token
 * - 把更新後的 session 更新回 cookie
 * - 未登入使用者自動重導到 /login
 *
 * 這是 @supabase/ssr 的標準用法，確保 client 端和 server 端的 auth state 一致。
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 讀取 session（從 cookie 直接讀，不需要網路 call）
  // 注意：getSession() 不驗證 token 是否被 server 撤銷，
  // 所以已登入者在 client 端仍用 getUser() 做定期驗證。
  // 這裡只管「有 cookie → 放行，無 cookie → 導 login」。
  const { data: sessionData } = await supabase.auth.getSession();

  const user = sessionData?.session?.user ?? null;

  // 未登入且不是 public route，重導到 /login
  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth/") ||
    request.nextUrl.pathname.startsWith("/api/push/") ||
    request.nextUrl.pathname.startsWith("/api/cron/") ||
    request.nextUrl.pathname.startsWith("/api/email/") ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/privacy") ||
    request.nextUrl.pathname.startsWith("/waitlist");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 已登入且在 login 頁，重導到首頁
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
