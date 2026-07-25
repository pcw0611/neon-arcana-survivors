import { adminCookieHeader, isAdminConfigured, requireSameOrigin, verifyAdminToken } from "../../../admin-auth";

const NO_STORE = { "Cache-Control": "no-store" };
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415, headers: NO_STORE });
  }
  let body: { password?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400, headers: NO_STORE }); }

  if (!isAdminConfigured()) {
    return Response.json({ error: "관리자 설정이 아직 적용되지 않았습니다." }, { status: 503, headers: NO_STORE });
  }
  const password = String(body.password ?? "");
  if (!verifyAdminToken(password)) {
    return Response.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401, headers: NO_STORE });
  }

  const headers = new Headers(NO_STORE);
  headers.append("Set-Cookie", adminCookieHeader(password, SESSION_MAX_AGE));
  return Response.json({ ok: true }, { headers });
}
