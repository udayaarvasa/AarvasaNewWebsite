import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { EditPropertyForm } from "@/components/property/edit-property-form"

export const metadata = {
  title: "Edit Property | Aarvasa",
  description: "Update your property listing on Aarvasa",
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/dashboard")

  const { id } = await params

  return <EditPropertyForm propertyId={id} />
}
