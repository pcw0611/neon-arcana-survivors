import { notFound } from "next/navigation";
import { configuredAdminEmail, isAdminEmail } from "../admin-auth";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const configured = configuredAdminEmail();

  if (!configured) {
    return (
      <main style={{ padding: 40, color: "white", background: "#03040d", minHeight: "100vh" }}>
        관리자 설정을 적용하는 중입니다. 잠시 후 다시 시도해주세요.
      </main>
    );
  }
  if (!isAdminEmail(user.email)) notFound();

  return (
    <AdminDashboard
      displayName={user.displayName}
      email={user.email}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
