import {
  Lock,
  ShieldCheck,
  FileCheck,
  KeyRound,
  Fingerprint,
  CheckCircle,
} from "lucide-react";
import { MotionReveal } from "@/components/layout/motion-reveal";

const securityFeatures = [
  {
    icon: ShieldCheck,
    title: "Blockchain Verification",
    description: "Immutable transaction records with distributed ledger technology.",
  },
  {
    icon: FileCheck,
    title: "Smart Contracts",
    description: "Automated escrow and compliance, eliminating intermediary risks.",
  },
  {
    icon: KeyRound,
    title: "Digital Ownership",
    description: "Tokenized property deeds with cryptographic proof of ownership.",
  },
  {
    icon: Fingerprint,
    title: "KYC/AML Verified",
    description: "Every investor and listing passes institutional-grade compliance.",
  },
];

export function BlockchainSecurity() {
  return (
    <section className="relative overflow-hidden py-24" id="security">
      {/* Dark background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b0b0b] via-[#160b0f] to-[#240914]" />
      {/* Accent glow */}
      <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-[#d4af37]/6 blur-[100px]" />
      <div className="absolute bottom-0 left-0 h-[300px] w-[500px] rounded-full bg-[#7a1f3d]/10 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left: Content */}
          <MotionReveal>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/10 px-4 py-2 text-sm font-semibold text-[#f5d27a]">
                <Lock className="h-4 w-4" />
                Enterprise-Grade Security
              </span>
              <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                Every Transaction,{" "}
                <span className="gold-text">Immutable & Verified</span>
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/60">
                Aarvasa leverages blockchain infrastructure to eliminate fraud,
                reduce settlement times, and provide complete transactional
                transparency. Your investments are protected by cryptography, not
                just paperwork.
              </p>

              {/* Verification checklist */}
              <div className="mt-8 space-y-3">
                {[
                  "256-bit end-to-end encryption",
                  "Multi-signature transaction approval",
                  "Real-time audit trail",
                  "RERA compliance engine",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-[#d4af37]" />
                    <span className="text-sm font-medium text-white/80">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </MotionReveal>

          {/* Right: Feature cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {securityFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <MotionReveal key={feature.title} delay={i * 0.1}>
                  <div className="group rounded-2xl border border-white/8 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-[#d4af37]/25 hover:bg-white/8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1f3d] to-[#d4af37] text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">
                      {feature.description}
                    </p>
                  </div>
                </MotionReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
