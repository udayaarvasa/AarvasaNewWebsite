"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot,
  Building2,
  FileCheck2,
  Handshake,
  LineChart,
  ShieldCheck,
  Sparkles,
  Cpu,
  Wallet,
  Lock,
  Glasses,
  BadgeCheck,
  ArrowRight,
  BrainCircuit,
  BarChart4,
  Zap,
  Globe,
  CheckCircle2,
} from "lucide-react";

/* ── Data ──────────────────────────────────────────────────────────────────── */

const services = [
  {
    icon: Bot,
    title: "AI Property Intelligence",
    text: "Hyper-personalised property recommendations powered by deep learning — analysing budget, location, ROI potential, and risk profile in real-time.",
    badge: "Core AI",
  },
  {
    icon: LineChart,
    title: "Predictive ROI Analytics",
    text: "Compare rental yield, capital appreciation, liquidity scores, and micro-market growth patterns with institutional-grade forecasting models.",
    badge: "Analytics",
  },
  {
    icon: ShieldCheck,
    title: "Blockchain Verification",
    text: "Immutable on-chain title verification, transparent transaction histories, and smart-contract escrow for every property deal.",
    badge: "Security",
  },
  {
    icon: Building2,
    title: "End-to-End Management",
    text: "Full lifecycle support — from discovery and shortlisting through consultation, documentation, and seamless ownership transfer.",
    badge: "Operations",
  },
  {
    icon: Handshake,
    title: "Verified Agent Network",
    text: "Connect with vetted real estate professionals for site visits, negotiation strategies, and hyper-local market intelligence.",
    badge: "Network",
  },
  {
    icon: FileCheck2,
    title: "Smart Documentation",
    text: "AI-assisted title checks, rental comparables, KYC automation, and transaction document management in a unified digital vault.",
    badge: "Automation",
  },
  {
    icon: BadgeCheck,
    title: "100% Verified Listings",
    text: "Every property undergoes a rigorous multi-point verification covering legal compliance, structural integrity, and market valuation.",
    badge: "Trust",
  },
  {
    icon: Cpu,
    title: "Machine Learning Insights",
    text: "Advanced ML algorithms surface hidden investment opportunities, predict market sentiment shifts, and optimise portfolio allocation.",
    badge: "Deep Tech",
  },
  {
    icon: Wallet,
    title: "Flexible Investment Models",
    text: "Access fractional ownership, milestone-based instalments, and structured investment products designed for modern portfolios.",
    badge: "Finance",
  },
  {
    icon: Lock,
    title: "Smart Contract Escrow",
    text: "Automated capital deployment via audited smart contracts — eliminating intermediaries and ensuring trustless transaction finality.",
    badge: "Blockchain",
  },
  {
    icon: Glasses,
    title: "AR/VR Virtual Tours",
    text: "Explore properties from anywhere with photorealistic, immersive virtual walkthroughs powered by spatial computing technology.",
    badge: "Immersive",
  },
];

const heroStats = [
  { value: "₹70+ Cr", label: "Listings Value", icon: BarChart4 },
  { value: "11+", label: "Premium Services", icon: Zap },
  { value: "AI-First", label: "Technology Stack", icon: BrainCircuit },
  { value: "100%", label: "Verified Network", icon: Globe },
];

const processSteps = [
  { step: "01", title: "Intelligent Discovery", desc: "AI scans thousands of properties matching your exact investment criteria." },
  { step: "02", title: "Deep Due Diligence", desc: "Blockchain-verified title checks, ROI modelling, and risk assessment." },
  { step: "03", title: "Seamless Execution", desc: "Smart contract escrow, digital documentation, and instant ownership transfer." },
  { step: "04", title: "Portfolio Growth", desc: "Continuous monitoring, yield optimisation, and reinvestment intelligence." },
];

/* ── Animations ───────────────────────────────────────────────────────────── */

const fadeUp: any = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.23, 1, 0.32, 1] as any } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardReveal: any = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.23, 1, 0.32, 1] as any },
  },
};

/* ── Ambient Particles ────────────────────────────────────────────────────── */

function AmbientParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${1 + Math.random() * 2.5}px`,
            height: `${1 + Math.random() * 2.5}px`,
            background: `rgba(212, 175, 55, ${0.2 + Math.random() * 0.3})`,
            left: `${Math.random() * 100}%`,
            bottom: `-${Math.random() * 10}%`,
            animation: `services-particle ${12 + Math.random() * 18}s linear infinite`,
            animationDelay: `${Math.random() * 12}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Gradient Orbs ────────────────────────────────────────────────────────── */

function GradientOrbs() {
  return (
    <>
      {/* Top centre warm glow */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full animate-orb-drift pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, rgba(122, 0, 25, 0.5) 0%, transparent 70%)" }}
      />
      {/* Left gold reflection */}
      <div
        className="absolute top-[30%] -left-32 w-[400px] h-[400px] rounded-full animate-orb-drift pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 60%)",
          animationDelay: "5s",
          animationDuration: "25s",
        }}
      />
      {/* Right burgundy glow */}
      <div
        className="absolute top-[55%] -right-40 w-[600px] h-[500px] rounded-full animate-orb-drift pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle, rgba(91, 0, 23, 0.35) 0%, transparent 65%)",
          animationDelay: "8s",
          animationDuration: "22s",
        }}
      />
      {/* Bottom centre ambient */}
      <div
        className="absolute -bottom-60 left-1/3 w-[700px] h-[400px] rounded-full animate-orb-drift pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle, rgba(74, 0, 18, 0.3) 0%, transparent 65%)",
          animationDelay: "12s",
          animationDuration: "28s",
        }}
      />
    </>
  );
}

/* ── Page Component ───────────────────────────────────────────────────────── */

export default function ServicesPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden services-cinematic-bg services-vignette services-noise services-grid-lines">
      <GradientOrbs />
      <AmbientParticles />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-36 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Premium Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#1A0006]/60 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] backdrop-blur-xl"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Premium Service Suite
          </motion.div>

          {/* Luxury Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15 }}
            className="heading-serif text-5xl leading-[1.1] tracking-tight text-[#F8F4EF] sm:text-6xl md:text-7xl lg:text-[5.5rem]"
          >
            Invest with{" "}
            <span className="gold-shimmer-text">Intelligence</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35 }}
            className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-[#DCCDCE]/80 sm:text-lg font-light"
          >
            The complete AI-powered real estate investment ecosystem.
            From intelligent discovery to blockchain-secured ownership —
            every service engineered for the modern investor.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link
              href="/listings"
              className="group flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#b9872f] px-8 py-4 text-sm font-bold tracking-wide text-[#1A0006] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(212,175,55,0.3)]"
            >
              Explore Properties
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/ai-chat"
              className="flex items-center gap-2.5 rounded-xl border border-[#DCCDCE]/20 bg-white/5 px-8 py-4 text-sm font-semibold tracking-wide text-[#F8F4EF] backdrop-blur-md transition-all duration-300 hover:border-[#D4AF37]/30 hover:bg-white/10"
            >
              <BrainCircuit className="h-4 w-4 text-[#D4AF37]" />
              Ask AI Advisor
            </Link>
          </motion.div>

          {/* Floating Stat Cards */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mt-20 hidden w-full max-w-4xl grid-cols-4 gap-4 md:grid"
          >
            {heroStats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  variants={cardReveal}
                  className="service-card-glass rounded-2xl px-5 py-5 text-center animate-stat-float"
                  style={{ animationDelay: `${i * 0.6}s` }}
                >
                  <Icon className="mx-auto mb-3 h-5 w-5 text-[#D4AF37] animate-icon-glow" />
                  <div className="text-xl font-bold text-[#D4AF37]">{stat.value}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#DCCDCE]/70">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SERVICES GRID
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-32 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-16 text-center"
        >
          <h2 className="heading-serif text-3xl text-[#F8F4EF] sm:text-4xl md:text-5xl">
            The Full <span className="text-[#D4AF37]">Service</span> Arsenal
          </h2>
          <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#b9872f]" />
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[#DCCDCE]/60">
            Every tool, every technology, every advantage — purpose-built for intelligent real estate investment.
          </p>
        </motion.div>

        {/* Cards grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <motion.article
                key={service.title}
                variants={cardReveal}
                className="group service-card-ivory p-8 sm:p-9 h-full flex flex-col"
              >
                {/* Content */}
                <div className="relative z-10 flex flex-col h-full">
                  {/* Badge */}
                  <div className="mb-5 inline-flex items-center rounded-full border border-[#D4AF37]/20 bg-gradient-to-r from-[#D4AF37]/8 to-[#D4AF37]/4 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7A0019] self-start">
                    {service.badge}
                  </div>

                  {/* Icon */}
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7A0019] to-[#D4AF37] shadow-[0_4px_16px_rgba(122,0,25,0.25)] transition-all duration-500 group-hover:shadow-[0_6px_24px_rgba(212,175,55,0.3)] group-hover:scale-105">
                    <Icon className="h-7 w-7 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="text-[1.3rem] font-bold tracking-tight text-[#4A0012] leading-snug">
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-3 text-[0.9rem] leading-[1.7] text-[#7A5C5C] text-justify flex-1">
                    {service.text}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — Process Pipeline
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 pb-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            className="mb-20 text-center"
          >
            <h2 className="heading-serif text-3xl text-[#F8F4EF] sm:text-4xl md:text-5xl">
              Your Investment <span className="text-[#D4AF37]">Journey</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-[#DCCDCE]/60">
              Four precision-engineered stages from discovery to portfolio growth.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="relative"
          >
            {/* ── Premium Timeline Beam (Desktop) ── */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 pointer-events-none">
              {/* Layer 3: Ambient wide beam */}
              <div className="timeline-beam-ambient left-1/2 -translate-x-1/2" />
              {/* Layer 2: Soft glow halo */}
              <div className="timeline-beam-glow left-1/2 -translate-x-1/2" />
              {/* Layer 1: Bright gold core */}
              <div className="timeline-beam-core left-1/2 -translate-x-1/2" />

              {/* Flowing particles */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="timeline-flow-particle left-1/2 -translate-x-[1.5px]"
                  style={{
                    animationDuration: `${3.5 + i * 1.2}s`,
                    animationDelay: `${i * 1.4}s`,
                  }}
                />
              ))}
            </div>

            {/* ── Mobile Beam ── */}
            <div className="md:hidden absolute left-8 top-0 bottom-0 pointer-events-none">
              <div className="timeline-beam-ambient left-1/2 -translate-x-1/2" style={{ width: '24px' }} />
              <div className="timeline-beam-glow left-1/2 -translate-x-1/2" style={{ width: '8px' }} />
              <div className="timeline-beam-core left-1/2 -translate-x-1/2" />
              <div
                className="timeline-flow-particle left-1/2 -translate-x-[1.5px]"
                style={{ animationDuration: '4s' }}
              />
            </div>

            <div className="space-y-16 md:space-y-24">
              {processSteps.map((item, i) => {
                const isRight = i % 2 !== 0;
                return (
                  <motion.div
                    key={item.step}
                    variants={cardReveal}
                    className={`relative flex flex-col gap-6 md:flex-row md:items-center md:gap-0 ${
                      isRight ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    {/* Spacer for the opposite side */}
                    <div className="md:w-1/2" />

                    {/* ── Premium Node ── */}
                    <div className="absolute left-8 md:left-1/2 -translate-x-[14px] md:-translate-x-[14px] top-6 md:top-1/2 md:-translate-y-1/2 z-20">
                      {/* Outer glow ring */}
                      <div className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.12)_0%,transparent_70%)]" />
                      {/* Glass node */}
                      <div className="timeline-node relative h-7 w-7 rounded-full border-2 border-[#D4AF37] bg-gradient-to-br from-[#5B0017] to-[#3A000C] backdrop-blur-md">
                        {/* Inner bright dot */}
                        <div className="absolute inset-[5px] rounded-full bg-[#D4AF37]/60" />
                      </div>
                      {/* Decorative outer ring */}
                      <div className="absolute -inset-1.5 rounded-full border border-[#D4AF37]/15" style={{ animationDelay: `${i * 0.8}s` }} />
                    </div>

                    {/* ── Horizontal Connector + Card ── */}
                    <div
                      className={`md:w-1/2 pl-20 md:pl-0 flex items-center ${
                        isRight ? "md:flex-row-reverse md:pr-0" : ""
                      }`}
                    >
                      {/* Connector line (desktop) */}
                      <div
                        className={`hidden md:block w-10 flex-shrink-0 ${
                          isRight ? "timeline-connector timeline-connector-right" : "timeline-connector"
                        }`}
                      />

                      {/* Card */}
                      <div className="flex-1">
                        <div className="service-card-ivory p-8">
                          <div className={`mb-3 text-5xl font-black text-[#D4AF37]/15 leading-none ${isRight ? "md:text-right" : ""}`}>
                            {item.step}
                          </div>
                          <h3 className={`text-xl font-bold text-[#4A0012] ${isRight ? "md:text-right" : ""}`}>
                            {item.title}
                          </h3>
                          <p className={`mt-2 text-sm leading-relaxed text-[#7A5C5C] ${isRight ? "md:text-right" : ""}`}>
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          WHY AARVASA — Trust Indicators
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 pb-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative overflow-hidden rounded-[2.5rem] service-card-ivory p-10 sm:p-14 md:p-20"
          >
            {/* Decorative glow */}
            <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-[#D4AF37]/6 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-[#7A0019]/8 blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <h2 className="heading-serif text-center text-3xl text-[#4A0012] sm:text-4xl md:text-5xl mb-4">
                Why <span className="text-[#D4AF37]">Aarvasa</span>?
              </h2>
              <p className="mx-auto mb-14 max-w-lg text-center text-sm leading-relaxed text-[#7A5C5C]">
                The technology, the trust, and the track record that set us apart.
              </p>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { t: "AI-First Architecture", d: "Every decision backed by machine intelligence." },
                  { t: "Blockchain Security", d: "Immutable records, zero fraud risk." },
                  { t: "Institutional Analytics", d: "Hedge-fund grade forecasting models." },
                  { t: "Verified Ecosystem", d: "100% compliance-checked listings." },
                  { t: "Global Reach", d: "Multi-city, multi-country expansion." },
                  { t: "Premium Support", d: "White-glove concierge for every investor." },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-[#DCCDCE]/15 bg-white/50 p-5 transition-all duration-300 hover:border-[#D4AF37]/20 hover:shadow-[0_4px_16px_rgba(212,175,55,0.06)]"
                  >
                    <div className="mt-0.5 rounded-full bg-gradient-to-br from-[#7A0019] to-[#D4AF37] p-1.5 shadow-sm">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#4A0012]">{item.t}</h4>
                      <p className="mt-1 text-xs text-[#7A5C5C]">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h2 className="heading-serif text-3xl text-[#F8F4EF] sm:text-4xl md:text-5xl">
              Ready to Invest <span className="gold-shimmer-text">Smarter</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-[#DCCDCE]/60">
              Start with AI-curated listings or let our advisor craft a personalised investment strategy for your portfolio.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/listings"
                className="group flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#b9872f] px-10 py-4 text-sm font-bold tracking-wide text-[#1A0006] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_48px_rgba(212,175,55,0.3)]"
              >
                Explore Listings
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/ai-chat"
                className="flex items-center gap-2.5 rounded-xl border border-[#DCCDCE]/20 bg-white/5 px-10 py-4 text-sm font-semibold tracking-wide text-[#F8F4EF] backdrop-blur-md transition-all duration-300 hover:border-[#D4AF37]/30 hover:bg-white/10"
              >
                Talk to AI Advisor
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
