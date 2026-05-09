import {
  Brain,
  LineChart,
  TrendingUp,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "./section-header";
import { MotionReveal } from "@/components/layout/motion-reveal";

const features = [
  {
    icon: Brain,
    title: "Predictive Analytics",
    description:
      "Machine learning models trained on 10M+ data points forecast property value trajectories with 94% accuracy.",
    gradient: "from-[#7a1f3d] to-[#d4af37]",
  },
  {
    icon: LineChart,
    title: "ROI Intelligence",
    description:
      "Real-time ROI scoring powered by rental yields, location demand curves, and macroeconomic signals.",
    gradient: "from-[#d4af37] to-[#f5d27a]",
  },
  {
    icon: TrendingUp,
    title: "Market Pulse",
    description:
      "Live market sentiment tracking across 50+ Indian cities, updated every 15 minutes with verified data.",
    gradient: "from-[#481123] to-[#7a1f3d]",
  },
  {
    icon: Target,
    title: "Smart Matching",
    description:
      "AI-curated property recommendations aligned to your risk appetite, budget, and investment timeline.",
    gradient: "from-[#7a1f3d] to-[#9c284d]",
  },
  {
    icon: Zap,
    title: "Instant Insights",
    description:
      "Ask our AI advisor any property question. From EMI calculations to neighborhood analysis, in seconds.",
    gradient: "from-[#d4af37] to-[#b9872f]",
  },
  {
    icon: Sparkles,
    title: "Portfolio Optimizer",
    description:
      "Diversification engine that balances your real estate portfolio across risk, yield, and growth vectors.",
    gradient: "from-[#481123] to-[#d4af37]",
  },
];

export function AIAnalytics() {
  return (
    <section
      className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
      id="ai-analytics"
    >
      <MotionReveal>
        <SectionHeader
          badge="Powered by AI"
          title="Intelligence That Drives Decisions"
          description="Our proprietary AI engine analyzes market dynamics, property fundamentals, and investor profiles to surface opportunities invisible to the naked eye."
          align="center"
        />
      </MotionReveal>

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <MotionReveal key={feature.title} delay={i * 0.08}>
              <Card className="group relative overflow-hidden border-border/50 bg-card p-7 transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow">
                {/* Hover gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative">
                  <div
                    className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </Card>
            </MotionReveal>
          );
        })}
      </div>
    </section>
  );
}
