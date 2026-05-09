import Link from "next/link";
import { ArrowRight, Building2, Handshake, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";

const personas = [
  {
    icon: Building2,
    title: "For Developers",
    description: "List premium projects, access qualified investor leads, and leverage AI-driven demand analytics.",
    cta: "Partner with Us",
    href: "/contact",
    gradient: "from-[#7a1f3d] to-[#481123]",
  },
  {
    icon: Handshake,
    title: "For Brokers",
    description: "Streamline deals with smart matching, automated documentation, and transparent commission tracking.",
    cta: "Join as Agent",
    href: "/agents",
    gradient: "from-[#481123] to-[#d4af37]",
  },
  {
    icon: Code,
    title: "For Tech Partners",
    description: "Integrate with our APIs. Build on top of Aarvasa's property intelligence infrastructure.",
    cta: "View API Docs",
    href: "/contact",
    gradient: "from-[#d4af37] to-[#7a1f3d]",
  },
];

export function OnboardingCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" id="onboarding">
      <MotionReveal>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Build the Future of Real Estate <span className="gold-text">With Us</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Whether you&apos;re a developer, broker, or technology partner — Aarvasa is your platform for growth.
          </p>
        </div>
      </MotionReveal>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {personas.map((persona, i) => {
          const Icon = persona.icon;
          return (
            <MotionReveal key={persona.title} delay={i * 0.1}>
              <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${persona.gradient} p-8 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-glow`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="relative">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-black">{persona.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-white/75">{persona.description}</p>
                  <Button asChild variant="glass" className="mt-6 border-white/20 text-white hover:bg-white/20">
                    <Link href={persona.href}>
                      {persona.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </MotionReveal>
          );
        })}
      </div>
    </section>
  );
}
