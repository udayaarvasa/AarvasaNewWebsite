import { Blocks, FileCheck2, Fingerprint, LockKeyhole, Shield, ShieldCheck, Sparkles } from "lucide-react";
import { BlockchainFlow } from "@/components/blockchain/blockchain-flow";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: FileCheck2,
    title: "Smart Contracts",
    text: "Encode escrow conditions, payment release, and document checkpoints in a transparent execution layer.",
  },
  {
    icon: Fingerprint,
    title: "Decentralized Identity",
    text: "Attach consent and investor verification to a reusable identity primitive without exposing raw identity data.",
  },
  {
    icon: LockKeyhole,
    title: "Zero-Knowledge Proof",
    text: "Validate eligibility, KYC checkpoints, and document integrity while minimizing sensitive data exposure.",
  },
];

const securityItems = [
  "256-bit end-to-end encryption",
  "Multi-signature transaction approval",
  "Real-time audit trail",
  "RERA compliance engine",
  "Decentralized escrow",
];

export default function BlockchainPage() {
  return (
    <div className="min-h-screen bg-[#0b0b0b] text-[#F2F1ED]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#50080E]/20 blur-[120px]" />
        <div className="absolute right-1/4 top-1/2 h-[300px] w-[400px] rounded-full bg-[#D4AF37]/8 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
              <Blocks className="h-3.5 w-3.5" />
              Blockchain Transaction Layer
            </div>
            <h1 className="heading-serif text-4xl text-[#F2F1ED] sm:text-5xl lg:text-6xl">
              Every Transaction,{" "}
              <span className="gold-text">Immutable &amp; Verified</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#DCCDCE]/60">
              Aarvasa leverages blockchain infrastructure to eliminate fraud, enable trust, and provide complete transparency.
            </p>
          </div>
        </div>
      </section>

      {/* Blockchain flow visualization */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <BlockchainFlow />
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-[#DCCDCE]/10 bg-white/[0.04] p-6 backdrop-blur-xl transition hover:border-[#D4AF37]/20 hover:bg-white/[0.06]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#b9872f] text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-[#F2F1ED]">{feature.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#DCCDCE]/50">{feature.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security section */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#DCCDCE]/10 bg-white/[0.03] p-8 backdrop-blur-xl sm:p-10">
          <div className="flex items-start gap-4">
            <div className="gold-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="heading-serif text-2xl text-[#F2F1ED] sm:text-3xl">
                How Aarvasa Uses Blockchain
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#DCCDCE]/50">
                Aarvasa models each transaction as a verifiable journey: biometric consent creates the initial authorization, edge processors package the request, MPC nodes simulate distributed approval, and a smart-contract style escrow emits a transaction hash.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {securityItems.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl border border-[#DCCDCE]/10 bg-white/[0.03] px-4 py-3">
                    <Shield className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-sm text-[#DCCDCE]/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
