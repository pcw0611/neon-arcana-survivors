import { clearAdminCookieHeader, requireSameOrigin } from "../../../admin-auth";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  const headers = new Headers(NO_STORE);
  headers.append("Set-Cookie", clearAdminCookieHeader());
  return Response.json({ ok: true }, { headers });
}
