import { headers } from "next/headers";
import { isAdminSession } from "../admin-auth";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const authed = isAdminSession(requestHeaders.get("cookie") ?? "");

  if (!authed) return <AdminLogin />;

  return <AdminDashboard signOutPath="/api/admin/logout" />;
}
