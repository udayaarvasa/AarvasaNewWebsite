import Link from "next/link";
import {
  Bot,
  Building2,
  FileCheck2,
  Handshake,
  LineChart,
  ShieldCheck,
  Sparkles,
  Cpu,
  Wallet,
  Lock,
  Glasses,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Bot,
    title: "AI Property Suggestions",
    text: "Personalized property recommendations by budget, city, ROI potential, and risk profile.",
  },
  {
    icon: LineChart,
    title: "ROI Insights",
    text: "Compare rental yield, appreciation signals, liquidity, and micro-market growth patterns.",
  },
  {
    icon: Building2,
    title: "Property Management",
    text: "Manage discovery, shortlisting, consultation, documentation, and ownership workflows.",
  },
  {
    icon: Handshake,
    title: "Agent Network",
    text: "Connect with verified agents for site visits, negotiation, and local market intelligence.",
  },
  {
    icon: ShieldCheck,
    title: "Blockchain Verification",
    text: "Track secure transaction status with simulated smart-contract and escrow verification.",
  },
  {
    icon: FileCheck2,
    title: "Documentation Support",
    text: "Keep title checks, rental comps, KYC, and transaction documents organized in one flow.",
  },
  {
    icon: BadgeCheck,
    title: "100% Verified Property Listings",
    text: "Every property on our platform undergoes a rigorous multi-point verification process to ensure authenticity and legal compliance.",
  },
  {
    icon: Cpu,
    title: "AI-Powered Insights & Recommendations",
    text: "Leverage advanced machine learning algorithms to receive tailored investment advice and market trend predictions.",
  },
  {
    icon: Wallet,
    title: "Flexible Payment Models",
    text: "Access a variety of structured payment plans, including fractional ownership and milestones-based installments.",
  },
  {
    icon: Lock,
    title: "Blockchain Based Smart Contracts",
    text: "Experience unprecedented security and transparency with immutable digital contracts that automate escrow and title transfers.",
  },
  {
    icon: Glasses,
    title: "AR/VR Virtual Property Tours",
    text: "Explore your potential investment from anywhere in the world with high-fidelity, immersive virtual walkthroughs.",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#DCCDCE]/60 bg-[#F5F4F1] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#72383D]">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            Premium Services
          </div>
          <h1 className="heading-serif text-4xl tracking-tight text-[#50080E] sm:text-5xl">
            Everything You Need to Invest Smarter
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[#72383D]/70">
            Aarvasa brings the complete real estate investment journey together: AI search, verified agents, ROI analytics, secure transaction workflows, and post-purchase support.
          </p>
        </div>

        {/* Service grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article
                key={service.title}
                className="group rounded-2xl border border-[#DCCDCE]/40 bg-white p-7 shadow-luxury-sm transition hover:-translate-y-1 hover:shadow-luxury"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#50080E] to-[#72383D] text-white transition group-hover:from-[#D4AF37] group-hover:to-[#b9872f]">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-[#50080E]">{service.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#72383D]/70">{service.text}</p>
              </article>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-14 overflow-hidden rounded-2xl bg-gradient-to-br from-[#50080E] to-[#2A0815] p-8 sm:p-12">
          <h2 className="heading-serif text-3xl text-[#F2F1ED] sm:text-4xl">
            Ready to manage your property smarter?
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#DCCDCE]/80">
            Start with curated listings or ask Aarvasa AI for investment options under your budget.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="gold" className="shadow-gold-sm">
              <Link href="/listings">Explore Listings</Link>
            </Button>
            <Button asChild variant="glass" className="border-[#DCCDCE]/20 text-[#F2F1ED]">
              <Link href="/ai-chat">Ask AI</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
