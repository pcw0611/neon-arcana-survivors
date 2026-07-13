import { env } from "cloudflare:workers";

export function configuredAdminEmail(): string | null {
  const runtime = env as unknown as { ADMIN_EMAIL?: string };
  const email = String(runtime.ADMIN_EMAIL ?? "").trim().toLowerCase();
  return email || null;
}

export function isAdminEmail(email: string): boolean {
  const configured = configuredAdminEmail();
  return Boolean(configured && email.trim().toLowerCase() === configured);
}

export function authorizeAdminRequest(request: Request): Response | null {
  const configured = configuredAdminEmail();
  if (!configured) {
    return Response.json(
      { error: "관리자 설정이 아직 적용되지 않았습니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) {
    return Response.json(
      { error: "ChatGPT 로그인이 필요합니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (email !== configured) {
    return Response.json(
      { error: "관리자 권한이 없습니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json(
      { error: "허용되지 않은 요청입니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}
