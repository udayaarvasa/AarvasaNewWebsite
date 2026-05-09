import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";

export function InvestCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <MotionReveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7a1f3d] via-[#481123] to-[#240914] p-10 sm:p-16 lg:p-20">
          {/* Glow effects */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#d4af37]/15 blur-[80px]" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#d4af37]/10 blur-[80px]" />
          <div className="absolute left-1/2 top-0 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent" />

          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f5d27a]/30 bg-[#f5d27a]/10 px-4 py-2 text-sm font-semibold text-[#f5d27a]">
              <Sparkles className="h-4 w-4" />
              Start Investing Smarter
            </span>
            <h2 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              Your Next Great Investment Is{" "}
              <span className="gold-text">One Click Away</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/65">
              Join thousands of investors who use Aarvasa&apos;s AI to discover, analyze,
              and secure premium real estate opportunities.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild variant="gold" size="lg" className="text-base">
                <Link href="/ai-chat">
                  <Sparkles className="h-5 w-5" />
                  Talk to AI Advisor
                </Link>
              </Button>
              <Button asChild variant="glass" size="lg" className="border-white/20 text-white hover:bg-white/15">
                <Link href="/listings">
                  Explore Properties
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </MotionReveal>
    </section>
  );
}
