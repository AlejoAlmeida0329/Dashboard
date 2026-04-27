import { type NextRequest, NextResponse } from "next/server";

import { decrypt, SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Auth gate proxy.
 *
 * Runs on every request matched by `config.matcher`. Public paths short-
 * circuit; everything else requires a valid session JWT in the cookie or
 * is redirected to /login.
 *
 * Per Next.js docs, the proxy is OPTIMISTIC — it must not be the only
 * line of defense. Server Components and Server Actions that read
 * sensitive data ALSO call `verifySession()` from `@/lib/auth/dal`.
 * Cookie writes happen in the login Server Action, never here.
 */

const PUBLIC_PATHS = ["/login"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decrypt(cookie);

  if (!payload?.authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static assets so the gate never blocks
    // /_next/static, /_next/image, favicon, or the logout route handler
    // (which clears the cookie itself).
    "/((?!_next/static|_next/image|favicon.ico|logout).*)",
  ],
};
