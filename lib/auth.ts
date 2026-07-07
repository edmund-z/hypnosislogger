// Single-user auth: one access code from env, session cookie after entry.
// Cookie value is a SHA-256 digest of the access code, so the code itself
// never lives in the browser. Uses Web Crypto so it runs in both the edge
// middleware and node route handlers.

export const AUTH_COOKIE = "hl_auth";

export function authEnabled(): boolean {
  return Boolean(process.env.ACCESS_CODE);
}

export async function expectedToken(): Promise<string> {
  const code = process.env.ACCESS_CODE ?? "";
  const data = new TextEncoder().encode(`hypnosis-logger-v1:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!token) return false;
  return token === (await expectedToken());
}
