import { TrendingUp, PieChart, BarChart3, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { SectionHeader } from "./section-header";

const widgets = [
  {
    icon: TrendingUp,
    title: "Portfolio Growth",
    value: "+23.4%",
    change: "+2.1% this month",
    positive: true,
    chart: [30, 42, 38, 50, 55, 62, 58, 70, 68, 78, 82, 90],
  },
  {
    icon: PieChart,
    title: "Asset Allocation",
    segments: [
      { label: "Residential", pct: 45, color: "#7a1f3d" },
      { label: "Commercial", pct: 25, color: "#d4af37" },
      { label: "Land", pct: 20, color: "#481123" },
      { label: "REITs", pct: 10, color: "#f5d27a" },
    ],
  },
  {
    icon: BarChart3,
    title: "Monthly Revenue",
    value: "₹4.2L",
    change: "Rental income",
    positive: true,
    chart: [40, 55, 48, 62, 58, 72, 65, 80, 75, 88, 82, 95],
  },
  {
    icon: Activity,
    title: "Market Score",
    value: "92/100",
    change: "Bullish sentiment",
    positive: true,
  },
];

export function DashboardPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" id="dashboard">
      <MotionReveal>
        <SectionHeader
          badge="Investor Dashboard"
          title="Your Portfolio, Visualized"
          description="Real-time analytics, performance tracking, and AI-driven portfolio optimization — all in one premium dashboard."
          align="center"
        />
      </MotionReveal>

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.map((widget, i) => {
          const Icon = widget.icon;
          return (
            <MotionReveal key={widget.title} delay={i * 0.1}>
              <Card className="group overflow-hidden border-border/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1f3d] to-[#d4af37] text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  {widget.positive !== undefined && (
                    <span className="text-xs font-semibold text-emerald-500">
                      ↑ {widget.change}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {widget.title}
                </p>
                {widget.value && (
                  <p className="mt-1 text-2xl font-black text-foreground">
                    {widget.value}
                  </p>
                )}

                {/* Mini sparkline chart */}
                {widget.chart && (
                  <div className="mt-4 flex h-12 items-end gap-[3px]">
                    {widget.chart.map((v, j) => (
                      <div
                        key={j}
                        className="flex-1 rounded-t-sm bg-gradient-to-t from-[#7a1f3d] to-[#d4af37] opacity-60 transition-opacity group-hover:opacity-100"
                        style={{ height: `${v}%` }}
                      />
                    ))}
                  </div>
                )}

                {/* Pie chart segments */}
                {widget.segments && (
                  <div className="mt-4 space-y-2">
                    {widget.segments.map((s) => (
                      <div key={s.label} className="flex items-center gap-2 text-xs">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="flex-1 text-muted-foreground">{s.label}</span>
                        <span className="font-semibold text-foreground">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </MotionReveal>
          );
        })}
      </div>
    </section>
  );
}
