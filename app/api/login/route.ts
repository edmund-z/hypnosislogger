import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, expectedToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!authEnabled()) {
    return NextResponse.json({ ok: true });
  }
  if (!code || code !== process.env.ACCESS_CODE) {
    return NextResponse.json({ error: "Wrong access code." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
