import { Shield, ShieldCheck } from "lucide-react";
import AarvasaBlockchainInfrastructure from "@/components/blockchain/blockchain-infrastructure";

const securityItems = [
  "256-bit end-to-end encryption",
  "Multi-signature transaction approval",
  "Real-time audit trail",
  "RERA compliance engine",
  "Decentralized escrow",
];

export default function BlockchainPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden services-cinematic-bg services-vignette">
      {/* Ambient orbs */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full animate-orb-drift pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, rgba(122, 0, 25, 0.4) 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-[60%] -right-40 w-[500px] h-[400px] rounded-full animate-orb-drift pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, rgba(91, 0, 23, 0.25) 0%, transparent 65%)", animationDelay: "8s" }}
      />

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-32 pb-20 sm:px-6 lg:px-8">
        <AarvasaBlockchainInfrastructure />

        {/* Security section */}
        <section className="mt-16">
          <div className="service-card-ivory rounded-[2.5rem] p-8 sm:p-12 overflow-hidden relative">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-start gap-10 relative z-10">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7A0019] to-[#D4AF37] text-white shadow-[0_4px_20px_rgba(122,0,25,0.3)]">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h2 className="heading-serif text-3xl sm:text-4xl text-[#4A0012] mb-6">
                  The Standard of Institutional Trust
                </h2>
                <p className="max-w-4xl text-base leading-relaxed text-[#7A5C5C] mb-10">
                  Aarvasa models each transaction as a verifiable journey: biometric consent creates the initial authorization, edge processors package the request, MPC nodes simulate distributed approval, and a smart-contract style escrow emits a transaction hash. Our infrastructure ensures that high-value property investments are de-risked through absolute, immutable transparency.
                </p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {securityItems.map((item) => (
                    <div key={item} className="flex items-center gap-4 p-5 rounded-2xl bg-white/60 border border-[#DCCDCE]/20 shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(212,175,55,0.06)] hover:border-[#D4AF37]/20 transition-all group">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#7A0019] to-[#D4AF37] flex items-center justify-center shadow-sm">
                        <Shield className="h-4 w-4 shrink-0 text-white" />
                      </div>
                      <span className="text-sm font-bold text-[#4A0012] tracking-wide">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
