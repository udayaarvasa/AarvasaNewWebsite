import { LoginForm } from "@/components/auth/login-form"
import Image from "next/image"
import Link from "next/link"

export const metadata = {
  title: "Login | Aarvasa",
  description: "Sign in to your Aarvasa premium PropTech account",
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-[#0A0A0A] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#50080E]/20 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#D4AF37]/10 blur-[100px]" />
      </div>

      {/* Left side - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 z-10 relative">
        <div className="absolute top-8 left-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative h-10 w-44 sm:h-12 sm:w-52">
              <Image
                src="/aarvasa-logo.png"
                alt="Aarvasa"
                fill
                className="object-contain brightness-0 invert opacity-90"
                priority
              />
            </span>
          </Link>
        </div>

        <LoginForm />
      </div>

      {/* Right side - Visuals */}
      <div className="hidden lg:flex w-1/2 relative z-10 items-center justify-center p-12">
        <div className="relative w-full h-full max-h-[800px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent z-10" />
          <Image
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop"
            alt="Luxury Property"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute bottom-12 left-12 right-12 z-20">
            <h3 className="text-4xl font-serif text-[#F2F1ED] mb-4">Invest in Tomorrow</h3>
            <p className="text-[#F2F1ED]/80 text-lg max-w-md">
              Access exclusive AI-curated real estate opportunities and institutional-grade insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
