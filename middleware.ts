import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, isValidToken } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const ok = await isValidToken(token);

  // /api/backup authenticates itself (cron secret OR session cookie).
  if (pathname === "/api/backup") {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/api/login") {
    if (ok && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!ok) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Protect everything except static assets and PWA files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest).*)",
  ],
};
