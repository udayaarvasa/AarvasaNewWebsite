"use client";

import { motion } from "framer-motion";
import {
  Fingerprint,
  FileCode2,
  Shield,
  ArrowRight,
  Network,
  Coins,
  Lock,
  Zap,
  ClipboardCheck,
  Scale,
  CreditCard,
  ScrollText,
  Building2,
  BrainCircuit,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════ */

const modules = {
  top: [
    { id: "identity", icon: Fingerprint, label: "Identity Verification", desc: "Biometric KYC and decentralized ID validation" },
    { id: "contracts", icon: FileCode2, label: "Smart Contracts", desc: "Automated escrow and programmable settlements" },
    { id: "escrow", icon: Shield, label: "Escrow Engine", desc: "Multi-signature trustless capital custody" },
  ],
  left: [
    { id: "fraud", icon: Zap, label: "AI Fraud Detection", desc: "Real-time anomaly scanning and risk alerts" },
    { id: "risk", icon: BrainCircuit, label: "AI Risk Analysis", desc: "Predictive risk scoring and exposure modeling" },
    { id: "validation", icon: ClipboardCheck, label: "Property Validation", desc: "Title verification and compliance checks" },
  ],
  right: [
    { id: "transfer", icon: ArrowRight, label: "Ownership Transfer", desc: "Immutable on-chain title registry updates" },
    { id: "tokenization", icon: Coins, label: "Tokenization", desc: "Fractional property investment instruments" },
    { id: "security", icon: Lock, label: "Transaction Security", desc: "AES-256 end-to-end encrypted pipelines" },
  ],
  bottom: [
    { id: "payment", icon: CreditCard, label: "Payment Gateway", desc: "Multi-rail institutional payment processing" },
    { id: "audit", icon: ScrollText, label: "Audit Trail", desc: "Immutable timestamped event logging" },
    { id: "compliance", icon: Scale, label: "Compliance Layer", desc: "RERA regulatory automation engine" },
  ],
};

type Module = { id: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string };

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.23, 1, 0.32, 1] as any } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const nodeReveal = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] as any } },
};

const pulseGlow = {
  animate: {
    boxShadow: [
      "0 0 30px rgba(212,175,55,0.15), 0 0 60px rgba(212,175,55,0.05)",
      "0 0 50px rgba(212,175,55,0.3), 0 0 100px rgba(212,175,55,0.1)",
      "0 0 30px rgba(212,175,55,0.15), 0 0 60px rgba(212,175,55,0.05)",
    ],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as any },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE NODE COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

function ModuleNode({ module: m, index, direction }: { module: Module; index: number; direction: "top" | "left" | "right" | "bottom" }) {
  const Icon = m.icon;
  const isHorizontal = direction === "top" || direction === "bottom";

  return (
    <motion.div
      variants={nodeReveal}
      className="group flex flex-col items-center text-center"
    >
      {/* Connector line going toward center */}
      {direction === "top" && (
        <div className="relative mb-3 h-10 w-px">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#D4AF37]/30" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#D4AF37]/60" />
        </div>
      )}

      {/* Card */}
      <div className="relative flex flex-col items-center rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 backdrop-blur-md transition-all duration-400 hover:border-[#D4AF37]/30 hover:bg-white/[0.07] hover:shadow-[0_0_30px_rgba(212,175,55,0.08)] w-full max-w-[200px]">
        {/* Icon container */}
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B0017] to-[#2a0010] border border-[#D4AF37]/15 shadow-lg transition-all duration-400 group-hover:border-[#D4AF37]/40 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]">
          <Icon className="h-5 w-5 text-[#D4AF37]" />
        </div>
        {/* Label */}
        <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#F8F4EF] leading-tight mb-1.5">
          {m.label}
        </h4>
        {/* Description */}
        <p className="text-[10px] leading-snug text-[#DCCDCE]/45">
          {m.desc}
        </p>
      </div>

      {/* Connector line going toward center */}
      {direction === "bottom" && (
        <div className="relative mt-3 h-10 w-px">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[#D4AF37]/30" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#D4AF37]/60" />
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDE MODULE LIST (for left/right columns)
   ═══════════════════════════════════════════════════════════════════════ */

function SideModules({ items, side }: { items: Module[]; side: "left" | "right" }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={stagger}
      className="flex flex-col gap-5"
    >
      {items.map((m, i) => {
        const Icon = m.icon;
        return (
          <motion.div
            key={m.id}
            variants={nodeReveal}
            className={`group flex items-center gap-4 ${side === "right" ? "flex-row-reverse text-right" : ""}`}
          >
            {/* Card */}
            <div className={`flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 backdrop-blur-md transition-all duration-400 hover:border-[#D4AF37]/30 hover:bg-white/[0.07] hover:shadow-[0_0_30px_rgba(212,175,55,0.08)] flex-1 max-w-[240px] ${side === "right" ? "flex-row-reverse" : ""}`}>
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B0017] to-[#2a0010] border border-[#D4AF37]/15 shadow-lg transition-all duration-400 group-hover:border-[#D4AF37]/40 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                <Icon className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div className={side === "right" ? "text-right" : ""}>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#F8F4EF] leading-tight mb-0.5">
                  {m.label}
                </h4>
                <p className="text-[10px] leading-snug text-[#DCCDCE]/45">
                  {m.desc}
                </p>
              </div>
            </div>

            {/* Horizontal connector */}
            <div className="relative h-px w-8 flex-shrink-0 hidden lg:block">
              <div className={`absolute inset-0 ${side === "left" ? "bg-gradient-to-r" : "bg-gradient-to-l"} from-[#D4AF37]/30 to-transparent`} />
              <div className={`absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#D4AF37]/60 ${side === "left" ? "right-0" : "left-0"}`} />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AMBIENT PARTICLES
   ═══════════════════════════════════════════════════════════════════════ */

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            background: `rgba(212,175,55,${0.15 + Math.random() * 0.25})`,
            left: `${Math.random() * 100}%`,
            bottom: `-${Math.random() * 10}%`,
            animation: `services-particle ${14 + Math.random() * 16}s linear infinite`,
            animationDelay: `${Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function BlockchainArchitecture() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-gradient-to-br from-[#0b0b0b] via-[#1a0510] to-[#0b0b0b] shadow-2xl">

      {/* ── Background Layers ──────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_40%,rgba(122,0,25,0.2),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.03),transparent_50%)]" />

      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(212,175,55,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.15) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent)",
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_30%,rgba(0,0,0,0.5)_100%)]" />

      <Particles />

      {/* ── CONTENT ────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-6 py-14 sm:px-10 lg:px-16 lg:py-20">

        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mx-auto mb-16 max-w-3xl text-center lg:mb-20"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#D4AF37] backdrop-blur-md">
            <Network className="h-3.5 w-3.5" />
            Blockchain Infrastructure
          </div>

          <h2 className="heading-serif text-3xl leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.5rem]">
            Institutional-Grade{" "}
            <span className="gold-shimmer-text">Blockchain</span>{" "}
            Orchestration
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-[#DCCDCE]/50 sm:text-base">
            Aarvasa combines MPC validation, smart contracts, decentralized identity, AI fraud analysis, and blockchain settlement infrastructure into a unified transaction engine.
          </p>
        </motion.div>

        {/* ── ARCHITECTURE MAP ─────────────────────────────────────────── */}

        {/* DESKTOP: Centralized radial layout */}
        <div className="hidden lg:block">
          {/* TOP ROW */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="flex justify-center gap-6 mb-4"
          >
            {modules.top.map((m, i) => (
              <ModuleNode key={m.id} module={m} index={i} direction="top" />
            ))}
          </motion.div>

          {/* MIDDLE: Left | Center Hub | Right */}
          <div className="flex items-center justify-center gap-0">
            {/* Left column */}
            <div className="flex-shrink-0">
              <SideModules items={modules.left} side="left" />
            </div>

            {/* CENTER HUB */}
            <div className="mx-4 flex-shrink-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] as any }}
                className="relative"
              >
                {/* Outer rotating gradient ring */}
                <div className="absolute -inset-4 rounded-full animate-gradient-rotate opacity-30" style={{
                  background: "conic-gradient(from 0deg, #D4AF37, transparent, #7A0019, transparent, #D4AF37)",
                  filter: "blur(16px)",
                }} />

                {/* Glow aura */}
                <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.1)_0%,transparent_70%)] animate-pulse-glow" />

                {/* Hub card */}
                <motion.div
                  {...pulseGlow}
                  className="relative flex h-52 w-52 flex-col items-center justify-center rounded-full border-2 border-[#D4AF37]/30 bg-gradient-to-br from-[#1a0a02]/80 to-[#0b0b0b]/90 backdrop-blur-xl"
                >
                  {/* Inner decorative ring */}
                  <div className="absolute inset-3 rounded-full border border-[#D4AF37]/10" />

                  <Building2 className="mb-3 h-9 w-9 text-[#D4AF37]" />
                  <div className="text-center px-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] mb-1">
                      Aarvasa
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#F8F4EF]/70 leading-tight">
                      Blockchain<br />Engine
                    </div>
                  </div>

                  {/* Pulse ring animation */}
                  <div className="absolute inset-0 rounded-full border border-[#D4AF37]/20 animate-ping" style={{ animationDuration: "3s" }} />
                </motion.div>
              </motion.div>
            </div>

            {/* Right column */}
            <div className="flex-shrink-0">
              <SideModules items={modules.right} side="right" />
            </div>
          </div>

          {/* BOTTOM ROW */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="flex justify-center gap-6 mt-4"
          >
            {modules.bottom.map((m, i) => (
              <ModuleNode key={m.id} module={m} index={i} direction="bottom" />
            ))}
          </motion.div>
        </div>

        {/* ── MOBILE / TABLET: Vertical Flow ────────────────────────────── */}
        <div className="lg:hidden">
          {/* Center Hub */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mx-auto mb-10 flex flex-col items-center"
          >
            <motion.div
              {...pulseGlow}
              className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 border-[#D4AF37]/30 bg-gradient-to-br from-[#1a0a02]/80 to-[#0b0b0b]/90 backdrop-blur-xl"
            >
              <div className="absolute inset-3 rounded-full border border-[#D4AF37]/10" />
              <Building2 className="mb-2 h-7 w-7 text-[#D4AF37]" />
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]">Aarvasa</div>
              <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#F8F4EF]/60">Blockchain Engine</div>
            </motion.div>
          </motion.div>

          {/* All modules in a responsive grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {[...modules.top, ...modules.left, ...modules.right, ...modules.bottom].map((m) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.id}
                  variants={nodeReveal}
                  className="group flex flex-col items-center rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 backdrop-blur-md text-center transition-all duration-300 hover:border-[#D4AF37]/30"
                >
                  <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B0017] to-[#2a0010] border border-[#D4AF37]/15">
                    <Icon className="h-4.5 w-4.5 text-[#D4AF37]" />
                  </div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#F8F4EF] leading-tight mb-1">
                    {m.label}
                  </h4>
                  <p className="text-[9px] leading-snug text-[#DCCDCE]/40">{m.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ── LEGEND ───────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-16 flex flex-wrap items-center justify-center gap-6 text-[10px] uppercase tracking-[0.2em] text-[#DCCDCE]/35"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.5)]" />
            Active Data Stream
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full border border-[#D4AF37]/50" />
            Encrypted Sub-process
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#5B0017] to-[#D4AF37]" />
            Core Verification
          </div>
        </motion.div>
      </div>
    </section>
  );
}