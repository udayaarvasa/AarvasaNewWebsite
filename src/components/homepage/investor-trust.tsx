"use client";

import { motion } from "framer-motion";
import { Shield, Users, Award, Globe } from "lucide-react";
import Image from "next/image";
import { AnimatedCounter } from "./animated-counter";
import { MotionReveal } from "@/components/layout/motion-reveal";

const trustMetrics = [
  {
    icon: Users,
    value: 12000,
    suffix: "+",
    label: "Active Investors",
    description: "High-net-worth individuals trust Aarvasa",
  },
  {
    icon: Globe,
    value: 50,
    suffix: "+",
    label: "Cities Covered",
    description: "Pan-India market intelligence",
  },
  {
    icon: Award,
    value: 4.9,
    suffix: "/5",
    decimals: 1,
    label: "Investor Rating",
    description: "Average rating from verified investors",
  },
  {
    icon: Shield,
    value: 100,
    suffix: "%",
    label: "Verified Properties",
    description: "Every listing legally & physically verified",
  },
];

const logos = [
  { name: "VITTBI", image: "/images/partners/vit-tbi.jpg" },
  { name: "GSEA", image: "/images/partners/gsea.png" },
  { name: "build3", image: "/images/partners/build3.png" },
  { name: "Startupindia", image: "/images/partners/startupindia.png" },
  { name: "AU Bank", image: "/images/partners/au-bank.png" },
  { name: "NVIDIA", image: "/images/partners/nvidia.png" },
  { name: "PS Associates", image: "/images/partners/ps-associates.jpg" },
  { name: "AWS", image: "/images/partners/aws.png" },
];

export function InvestorTrust() {
  return (
    <section className="relative overflow-hidden py-24" id="trust">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[#7a1f3d]/5 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MotionReveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
              <Shield className="h-4 w-4" />
              Trusted by Leading Investors
            </span>
            <h2 className="mt-6 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Built on Trust,{" "}
              <span className="gold-text">Backed by Data</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Institutional-grade due diligence meets consumer-friendly
              intelligence. Every data point is audited, every recommendation
              explainable.
            </p>
          </div>
        </MotionReveal>

        {/* Metrics grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trustMetrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <MotionReveal key={metric.label} delay={i * 0.1}>
                <div className="group rounded-2xl border border-border bg-card p-6 text-center shadow-glass backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-glow">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1f3d] to-[#d4af37] text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="text-3xl font-black text-foreground">
                    <AnimatedCounter
                      end={metric.value}
                      suffix={metric.suffix}
                      decimals={metric.decimals}
                    />
                  </p>
                  <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-primary">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
              </MotionReveal>
            );
          })}
        </div>

        {/* Partner logos */}
        <MotionReveal delay={0.3}>
          <div className="mt-20 overflow-hidden relative w-full">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-8">
              Trusted by partners at
            </p>
            {/* Fade masks for edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
            
            <div className="flex">
              <motion.div
                className="flex shrink-0 items-center gap-x-24 pr-24 whitespace-nowrap"
                animate={{ x: ["0%", "-100%"] }}
                transition={{
                  ease: "linear",
                  duration: 25,
                  repeat: Infinity,
                }}
              >
                {[...logos, ...logos].map((logo, i) => (
                  <span
                    key={`${logo.name}-${i}`}
                    className="flex items-center text-3xl font-bold text-muted-foreground/40 transition-colors hover:text-foreground/60"
                  >
                    {logo.image ? (
                      <Image 
                        src={logo.image} 
                        alt={logo.name} 
                        width={300} 
                        height={120} 
                        className="object-contain mix-blend-multiply dark:mix-blend-lighten" 
                        style={{ height: '90px', width: 'auto' }}
                      />
                    ) : (
                      logo.name
                    )}
                  </span>
                ))}
              </motion.div>
              <motion.div
                className="flex shrink-0 items-center gap-x-24 pr-24 whitespace-nowrap"
                animate={{ x: ["0%", "-100%"] }}
                transition={{
                  ease: "linear",
                  duration: 25,
                  repeat: Infinity,
                }}
              >
                {[...logos, ...logos].map((logo, i) => (
                  <span
                    key={`dup-${logo.name}-${i}`}
                    className="flex items-center text-3xl font-bold text-muted-foreground/40 transition-colors hover:text-foreground/60"
                  >
                    {logo.image ? (
                      <Image 
                        src={logo.image} 
                        alt={logo.name} 
                        width={300} 
                        height={120} 
                        className="object-contain mix-blend-multiply dark:mix-blend-lighten" 
                        style={{ height: '90px', width: 'auto' }}
                      />
                    ) : (
                      logo.name
                    )}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}
