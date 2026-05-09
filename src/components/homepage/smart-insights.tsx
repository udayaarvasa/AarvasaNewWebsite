import Link from "next/link";
import {
  BarChart3,
  Lightbulb,
  TrendingUp,
  Sparkles,
  MapPin,
  IndianRupee,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MotionReveal } from "@/components/layout/motion-reveal";

const insights = [
  {
    icon: TrendingUp,
    category: "Market Trend",
    title: "Goa Villa Market Surges 31% YoY",
    summary:
      "Short-term rental demand in North Goa continues its multi-year growth trajectory. Assagao, Anjuna, and Siolim lead absorption.",
    tags: ["High Growth", "Rental Yield"],
    metric: "+31%",
    metricLabel: "Demand Growth",
  },
  {
    icon: MapPin,
    category: "Location Intelligence",
    title: "Sector 72 Gurugram: The Next Micro-Market",
    summary:
      "Proximity to ITES corridors and metro expansion makes Sector 72 a top pick for 2025. Price momentum accelerating.",
    tags: ["Metro Corridor", "Emerging"],
    metric: "+24%",
    metricLabel: "Price Momentum",
  },
  {
    icon: IndianRupee,
    category: "Investment Signal",
    title: "Pune IT Belt: Affordable High-Yield Entry",
    summary:
      "Hinjewadi and Baner offer the best risk-adjusted yields in the sub-₹2Cr segment with 33% rental search growth.",
    tags: ["Affordable Entry", "AI Pick"],
    metric: "17.2%",
    metricLabel: "Projected ROI",
  },
];

export function SmartInsights() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" id="insights">
      <MotionReveal>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <Badge>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI Insights
            </Badge>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Smart Insights, <span className="gold-text">Sharper Moves</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Our AI scans 50+ cities, 1M+ listings, and thousands of
              micro-market signals to surface the intelligence that matters.
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 self-start md:self-auto">
            <Link href="/ai-chat">
              <Sparkles className="h-4 w-4" />
              Ask AI Advisor
            </Link>
          </Button>
        </div>
      </MotionReveal>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <MotionReveal key={insight.title} delay={i * 0.1}>
              <Card className="group flex h-full flex-col overflow-hidden border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow">
                {/* Header with metric */}
                <div className="flex items-start justify-between border-b border-border/50 p-6 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1f3d] to-[#d4af37] text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                      {insight.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black gold-text">
                      {insight.metric}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {insight.metricLabel}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {insight.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {insight.summary}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {insight.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </MotionReveal>
          );
        })}
      </div>
    </section>
  );
}
