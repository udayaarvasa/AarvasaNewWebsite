import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { verifyToken } from "@/lib/auth";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = verifyToken(cookieStore.get("aarvasa_token")?.value);

  if (!session) {
    redirect("/login");
  }

  return <DashboardClient userName={session.name} />;
}
