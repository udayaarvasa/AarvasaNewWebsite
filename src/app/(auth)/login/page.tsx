import { LoginForm } from "@/components/auth/login-form"
import Image from "next/image"
import { redirect } from "next/navigation"
import { auth } from "@/auth"

export const metadata = {
  title: "Login | Aarvasa",
  description: "Sign in to your Aarvasa premium PropTech account",
}

export default async function LoginPage() {
  // Signed-in visitors go to their dashboard. Reading the session here also
  // makes the page dynamic (private, no-store), so no shared cache keeps it.
  if (await auth()) redirect("/dashboard")

  return (
    <div data-surface="stage" className="min-h-screen flex bg-[#12070a] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-claret/20 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#D4AF37]/10 blur-[100px]" />
      </div>

      {/* Left side - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 pt-28 z-10 relative">

        <LoginForm />
      </div>

      {/* Right side - Visuals */}
      <div className="hidden lg:flex w-1/2 relative z-10 items-center justify-center p-12">
        <div className="relative w-full h-full max-h-[800px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent z-10" />
          <Image
            src="/images/reef-996/banners/reef-996-tower-crown-night-4x5.jpg"
            alt="REEF 996 at night, developer render"
            fill
            className="av-kenburns object-cover"
            sizes="50vw"
            priority
          />
          <div className="absolute bottom-12 left-12 right-12 z-20">
            <span className="av-meta mb-4 block text-[10px] text-[#F2F1ED]/60">Developer render</span>
            <h3 className="av-display mb-4 text-[56px] font-light leading-none text-[#F2F1ED]">Welcome <em className="lux-gold-text italic">back.</em></h3>
            <p className="text-[#F2F1ED]/80 text-lg max-w-md">
              Your saved properties, shortlists and enquiries, where you left them.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
