"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Bell,
  Brain,
  Building2,
  Calendar,
  IndianRupee,
  LineChart,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { PropertyCard } from "@/components/property/property-card";
import { RoiChart } from "@/components/roi-chart";
import { getRecommendations, properties, type Property, formatCurrency } from "@/lib/properties";

type Recommendation = Property & { matchScore: number; reason: string };

export function DashboardClient({ userName }: { userName: string }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    getRecommendations({ budget: 52000000 }) as Recommendation[],
  );

  useEffect(() => {
    fetch("/api/ai/recommendations?budget=52000000&risk=Balanced")
      .then((response) => response.json())
      .then((data) => {
        if (data.recommendations) {
          setRecommendations(data.recommendations);
        }
      })
      .catch(() => undefined);
  }, []);

  const summary = useMemo(() => {
    const saved = properties.slice(0, 3);
    return {
      saved,
      totalValue: saved.reduce((sum, item) => sum + item.price, 0),
      averageRoi: saved.reduce((sum, item) => sum + item.roi, 0) / saved.length,
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      {/* Welcome header */}
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-28 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h1 className="heading-serif text-3xl text-[#50080E] sm:text-4xl lg:text-5xl">
              Welcome back, {userName}
            </h1>
            <p className="mt-2 text-sm text-[#72383D]/70">
              Here is an overview of your portfolio and personalized insights.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 rounded-lg border-[#DCCDCE]/60">
              <Bell className="h-4 w-4" />
              Smart Alerts
            </Button>
            <Button variant="gold" size="sm" className="gap-2 rounded-lg">
              <Sparkles className="h-4 w-4" />
              New Exploration
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Portfolio metrics + AI Insights */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left: Metric cards */}
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Total Portfolio Value"
                value={formatCurrency(summary.totalValue)}
                icon={IndianRupee}
                trend="+5.3% this mo."
                trendUp
              />
              <StatCard
                label="Projected ROI"
                value={`${summary.averageRoi.toFixed(1)}%`}
                icon={TrendingUp}
                subtitle="Balanced market avg."
                trend="Above avg"
                trendUp
              />
              <StatCard
                label="Est. Monthly Rental"
                value="₹18,400"
                icon={WalletCards}
                subtitle="Total passive income"
                trend="Rental income"
                trendUp
              />
            </div>

            {/* Saved Properties */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold text-[#50080E]">
                  <Building2 className="h-5 w-5 text-[#D4AF37]" />
                  Saved Properties
                </h2>
                <Button variant="ghost" size="sm" className="text-xs text-[#72383D]">
                  View All Properties →
                </Button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {summary.saved.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            </div>
          </div>

          {/* Right: AI Insights + Concierge */}
          <div className="space-y-5">
            {/* AI Insights panel */}
            <Card className="border-[#DCCDCE]/40 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                <h3 className="text-sm font-bold text-[#50080E]">AI Insights</h3>
              </div>
              <p className="text-xs leading-relaxed text-[#72383D]/70">
                Based on your portfolio focus in high-yield luxury residential, our AI has identified an emerging market opportunity.
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[#DCCDCE]/30 bg-[#F5F4F1] p-3">
                  <p className="text-xs font-bold text-[#50080E]">📍 Micro Market Score</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#72383D]/70">
                    Projected 17% growth in Goa&apos;s Assagao belt per micro-market analysis.
                  </p>
                </div>
                <div className="rounded-xl border border-[#DCCDCE]/30 bg-[#F5F4F1] p-3">
                  <p className="text-xs font-bold text-[#50080E]">📊 Demand Signal</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#72383D]/70">
                    Rental search growth +33% in Hinjewadi for sub-₹2Cr segment.
                  </p>
                </div>
              </div>
            </Card>

            {/* Concierge panel */}
            <Card className="border-[#DCCDCE]/40 bg-white p-5">
              <h3 className="mb-4 text-sm font-bold text-[#50080E]">Your Concierge</h3>
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-full">
                  <Image
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
                    alt="Concierge"
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#50080E]">Sarah Jenkins</p>
                  <p className="text-[11px] text-[#72383D]/60">Senior Investment Advisor</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 rounded-lg border-[#DCCDCE]/50 text-xs">
                  <MessageSquare className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Send Message
                </Button>
                <Button variant="gold" size="sm" className="w-full justify-start gap-2 rounded-lg text-xs">
                  <Video className="h-3.5 w-3.5" />
                  Schedule Video Call
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Portfolio ROI + Capital Plan */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-[#DCCDCE]/40 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Portfolio ROI</p>
                <h3 className="text-xl font-bold text-[#50080E]">Growth Trend</h3>
              </div>
              <Badge variant="success">+4.8% vs market</Badge>
            </div>
            <RoiChart data={properties[0].roiSeries} />
          </Card>

          <Card className="border-[#DCCDCE]/40 bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="gold-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white">
                <WalletCards className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-[#72383D]/60">Investment Summary</p>
                <h3 className="text-xl font-bold text-[#50080E]">Capital Plan</h3>
              </div>
            </div>
            <div className="space-y-4">
              {[
                ["Committed", "40%"],
                ["Reserved", "35%"],
                ["Opportunity Cash", "25%"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-[#72383D]/60">{label}</span>
                    <span className="font-semibold text-[#50080E]">{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#DCCDCE]/30">
                    <div
                      className="gold-gradient h-2 rounded-full"
                      style={{ width: value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Blockchain + Transactions */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="border-[#DCCDCE]/40 bg-white p-6">
            <div className="mb-5 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-[#D4AF37]" />
              <h3 className="text-xl font-bold text-[#50080E]">Blockchain Verification</h3>
            </div>
            <div className="space-y-3">
              {[
                ["Escrow contract", "Verified"],
                ["MPC quorum", "4/5 nodes"],
                ["Document hash", "Matched"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-[#DCCDCE]/30 bg-[#F5F4F1]/60 p-4">
                  <span className="text-sm text-[#72383D]/70">{label}</span>
                  <Badge variant="success">{value}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-[#DCCDCE]/40 bg-white p-6">
            <div className="mb-5 flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-[#D4AF37]" />
              <h3 className="text-xl font-bold text-[#50080E]">Recent Transactions</h3>
            </div>
            <div className="space-y-3">
              {[
                ["AARVASA_ESCROW_V1", "0x91f...a82", "Verified"],
                ["TITLE_HASH_SYNC", "0x47c...d11", "Pending"],
                ["KYC_ATTESTATION", "0x62a...9ef", "Verified"],
              ].map(([name, hash, status]) => (
                <div key={hash} className="grid gap-1.5 rounded-xl border border-[#DCCDCE]/30 bg-[#F5F4F1]/60 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3">
                  <p className="text-sm font-semibold text-[#50080E]">{name}</p>
                  <p className="font-mono text-xs text-[#72383D]/50">{hash}</p>
                  <Badge variant={status === "Verified" ? "success" : "default"}>{status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
