/**
 * Next.js Middleware — Route Protection
 * Redirects unauthenticated users to /login for protected routes.
 * JWT is stored in localStorage (client-side only), so we use a cookie
 * set on login to signal authentication status to the middleware.
 *
 * Note: For full security, use httpOnly cookies in production.
 * This implementation uses a presence-check cookie (no sensitive data).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/student", "/teacher"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check for auth cookie (set by the client after login)
  const isLoggedIn = request.cookies.has("smartsoma_auth");
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*"],
};
