import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AdminPanel } from "@/components/admin/admin-panel"

export const metadata = {
  title: "Admin Panel | Aarvasa",
  description: "Platform administration and moderation",
}

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/admin")

  // Double-check role server-side (middleware also guards this)
  if ((session.user as any).role !== "ADMIN") {
    redirect("/dashboard")
  }

  return <AdminPanel />
}
