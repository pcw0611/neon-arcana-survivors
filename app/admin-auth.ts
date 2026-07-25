import { env } from "cloudflare:workers";

const ADMIN_COOKIE = "admin_auth";
const NO_STORE = { "Cache-Control": "no-store" };

function configuredAdminToken(): string | null {
  const runtime = env as unknown as { ADMIN_TOKEN?: string };
  const token = String(runtime.ADMIN_TOKEN ?? "");
  return token || null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { return null; }
  }
  return null;
}

export function isAdminConfigured(): boolean {
  return Boolean(configuredAdminToken());
}

export function verifyAdminToken(candidate: string): boolean {
  const configured = configuredAdminToken();
  return Boolean(configured && candidate && timingSafeEqual(candidate, configured));
}

export function isAdminSession(cookieHeader: string): boolean {
  const token = parseCookie(cookieHeader, ADMIN_COOKIE);
  return Boolean(token && verifyAdminToken(token));
}

export function adminCookieHeader(token: string, maxAgeSeconds: number): string {
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearAdminCookieHeader(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function authorizeAdminRequest(request: Request): Response | null {
  if (!configuredAdminToken()) {
    return Response.json({ error: "관리자 설정이 아직 적용되지 않았습니다." }, { status: 503, headers: NO_STORE });
  }
  if (!isAdminSession(request.headers.get("cookie") ?? "")) {
    return Response.json({ error: "관리자 인증이 필요합니다." }, { status: 401, headers: NO_STORE });
  }
  return null;
}

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403, headers: NO_STORE });
  }
  return null;
}
