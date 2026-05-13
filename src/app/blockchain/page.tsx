import { Blocks, FileCheck2, Fingerprint, LockKeyhole, Shield, ShieldCheck } from "lucide-react";
import AarvasaBlockchainInfrastructure from "@/components/blockchain/blockchain-infrastructure";

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
    <div className="min-h-screen bg-[#F2F1ED] text-[#50080E] pb-20">
      {/* Main Content */}
      <div className="relative mx-auto max-w-7xl px-4 pt-32 sm:px-6 lg:px-8">
        <AarvasaBlockchainInfrastructure />
      </div>

      {/* Security section */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 mt-12">
        <div className="rounded-[2.5rem] border border-[#DCCDCE]/60 bg-white/50 p-8 backdrop-blur-xl sm:p-12 shadow-luxury overflow-hidden relative">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row items-start gap-10 relative z-10">
            <div className="gold-gradient flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h2 className="heading-serif text-3xl sm:text-4xl text-[#50080E] mb-6">
                The Standard of Institutional Trust
              </h2>
              <p className="max-w-4xl text-lg leading-relaxed text-[#72383D]/80 mb-10">
                Aarvasa models each transaction as a verifiable journey: biometric consent creates the initial authorization, edge processors package the request, MPC nodes simulate distributed approval, and a smart-contract style escrow emits a transaction hash. Our infrastructure ensures that high-value property investments are de-risked through absolute, immutable transparency.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {securityItems.map((item) => (
                  <div key={item} className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-[#DCCDCE]/40 shadow-luxury-sm hover:shadow-luxury transition-all group">
                    <div className="h-8 w-8 rounded-full bg-[#50080E]/5 flex items-center justify-center group-hover:bg-[#50080E]/10 transition-colors">
                      <Shield className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                    </div>
                    <span className="text-sm font-bold text-[#72383D] tracking-wide">{item}</span>
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
