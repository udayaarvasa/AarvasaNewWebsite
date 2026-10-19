import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CreatePropertyForm } from "@/components/property/create-property-form"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "List a Property | Aarvasa",
  robots: { index: false, follow: true },
  description: "Create a new property listing on Aarvasa",
}

export default async function CreatePropertyPage() {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/properties/create")

  return (
    <div className="min-h-screen bg-paper-sunken">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="heading-serif text-3xl text-ink sm:text-4xl">
          List a New Property
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Create your property listing and reach premium investors.
        </p>
        <div className="mt-8">
          <CreatePropertyForm />
        </div>
      </div>
    </div>
  )
}
