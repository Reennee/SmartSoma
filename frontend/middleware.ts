import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through unconditionally
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith("/_next") || pathname.startsWith("/api"))) {
    return NextResponse.next();
  }

  const authed = request.cookies.get("smartsoma_auth")?.value === "1";

  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg).*)",
  ],
};
