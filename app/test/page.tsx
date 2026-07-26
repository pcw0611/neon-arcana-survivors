import { headers } from "next/headers";
import { isAdminSession } from "../admin-auth";
import AdminLogin from "../admin/AdminLogin";
import TestConsole from "./TestConsole";

export const dynamic = "force-dynamic";

export default async function TestPage() {
  const requestHeaders = await headers();
  const authed = isAdminSession(requestHeaders.get("cookie") ?? "");

  if (!authed) return <AdminLogin />;

  return <TestConsole />;
}
