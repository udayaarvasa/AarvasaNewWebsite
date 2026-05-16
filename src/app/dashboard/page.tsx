import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardView } from "@/components/dashboard/dashboard-view"

export const metadata = {
  title: "Dashboard | Aarvasa",
  description: "Manage your property portfolio and investments",
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/dashboard")

  return (
    <DashboardView
      userName={session.user.name || "User"}
      userRole={session.user.role || "USER"}
    />
  )
}
