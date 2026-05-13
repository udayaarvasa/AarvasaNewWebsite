"use client";

import { motion } from "framer-motion";
import {
  User,
  Fingerprint,
  Activity,
  Smartphone,
  Layout,
  ShieldCheck,
  Network,
  Box,
  FileCode2,
  UserCheck,
  LockKeyhole,
  Building2,
  Zap,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";

const createPath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number
) => {
  const midX = (startX + endX) / 2;

  return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
};

const nodes = [
  {
    id: 'user',
    label: 'User',
    icon: User,
    description: 'The investor initiating the secure luxury property transaction.',
    details: 'Initiates high-value transactions with cryptographic signatures.',
    position: { x: 10, y: 18 },
    category: 'entry'
  },
  {
    id: 'biometric',
    label: 'Biometric Validation',
    icon: Fingerprint,
    description: 'Hardware-level biometric authorization.',
    details: 'AES-256 encrypted biometric verification.',
    position: { x: 10, y: 36 },
    category: 'input'
  },
  {
    id: 'transaction',
    label: 'Transaction Request',
    icon: Activity,
    description: 'Transaction intent and metadata.',
    details: 'Secure transaction packet generation.',
    position: { x: 10, y: 54 },
    category: 'input'
  },
  {
    id: 'edge',
    label: 'Edge Processor',
    icon: Smartphone,
    description: 'Localized edge processing layer.',
    details: 'Packages and validates encrypted packets.',
    position: { x: 22, y: 82 },
    category: 'processor'
  },
  {
    id: 'shamir',
    label: 'Shamir Share',
    icon: Layout,
    description: 'Distributed secret sharing.',
    details: 'Splits secure transaction fragments.',
    position: { x: 40, y: 82 },
    category: 'processor-sub'
  },
  {
    id: 'verification',
    label: 'Verification Layer',
    icon: ShieldCheck,
    description: 'Distributed verification nodes.',
    details: 'Cross-node identity validation.',
    position: { x: 58, y: 82 },
    category: 'processor-sub'
  },
  {
    id: 'mpc',
    label: 'Consensus Engine',
    icon: Network,
    description: 'Multi-party computation consensus.',
    details: 'Distributed consensus validation.',
    position: { x: 74, y: 82 },
    category: 'consensus'
  },
  {
    id: 'blockchain',
    label: 'Blockchain Settlement',
    icon: Box,
    description: 'Immutable ledger settlement layer.',
    details: 'Finalized blockchain registry.',
    position: { x: 78, y: 52 },
    category: 'core'
  },
  {
    id: 'contract',
    label: 'Smart Contract',
    icon: FileCode2,
    description: 'Automated escrow execution.',
    details: 'Handles programmable settlements.',
    position: { x: 68, y: 20 },
    category: 'core-sub'
  },
  {
    id: 'did',
    label: 'Decentralized ID',
    icon: UserCheck,
    description: 'W3C decentralized identity.',
    details: 'Secure credential verification.',
    position: { x: 82, y: 12 },
    category: 'core-sub'
  },
  {
    id: 'zkp',
    label: 'ZK Proof',
    icon: LockKeyhole,
    description: 'Zero-knowledge verification.',
    details: 'Validates without revealing data.',
    position: { x: 96, y: 20 },
    category: 'core-sub'
  },
  {
    id: 'bank-backend',
    label: 'Bank Backend',
    icon: Building2,
    description: 'Institutional settlement engine.',
    details: 'Traditional banking integration.',
    position: { x: 92, y: 52 },
    category: 'settlement'
  },
  {
    id: 'bank-sub',
    label: 'AI Fraud Check',
    icon: Zap,
    description: 'AI-powered fraud monitoring.',
    details: 'Real-time anomaly detection.',
    position: { x: 92, y: 70 },
    category: 'settlement-sub'
  },
  {
    id: 'notification',
    label: 'Notification Response',
    icon: BellRing,
    description: 'Final investor response system.',
    details: 'Settlement notifications.',
    position: { x: 92, y: 88 },
    category: 'notification'
  }
];

function Node({
  node,
}: {
  node: (typeof nodes)[0];
}) {
  const Icon = node.icon;

  const isConsensus = node.category === "consensus";
  const isCore = node.category === "core";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute z-20 group"
      style={{
        left: `${node.position.x}%`,
        top: `${node.position.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 sm:h-16 sm:w-16",
            isConsensus
              ? "border-[#D4AF37] bg-[#1a1204] shadow-[0_0_60px_rgba(200,169,77,0.18)]"
              : isCore
                ? "border-[#D4AF37] bg-[#120b02] shadow-[0_0_28px_rgba(212,175,55,0.25)]"
                : "border-white/10 bg-white/[0.03] backdrop-blur-xl group-hover:border-[#D4AF37]/40"
          )}
        >
          <Icon className="h-6 w-6 text-[#DCCDCE] sm:h-7 sm:w-7" />
        </div>

        <div className="mt-3 flex flex-col items-center text-center max-w-[110px]">
          <div className="text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] mb-1 font-bold">
            {node.label}
          </div>

          <div className="text-[10px] text-[#DCCDCE]/70 leading-snug font-medium">
            {node.description}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function BlockchainArchitecture() {
  return (
    <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-br from-[#0b0b0b] via-[#50080E]/40 to-[#0b0b0b] px-6 py-8 sm:px-10 lg:px-14 shadow-2xl">
      {/* Background Gradient Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b0b0b] via-[#1a0510] to-[#0b0b0b] opacity-90" />
      
      {/* Cinematic Gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(80,8,14,0.3),transparent_70%)]" />
      
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(114,56,61,0.08),transparent_40%,rgba(0,0,0,0.8))]" />

      {/* Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.02),transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.025] mix-blend-soft-light bg-[url('/noise.png')]" />
      {/* Stage Labels */}

      <div className="absolute top-[14%] left-[10%] text-[10px] uppercase tracking-[0.35em] text-[#DCCDCE]/20">
        Input Layer
      </div>

      <div className="absolute top-[76%] left-[38%] text-[10px] uppercase tracking-[0.35em] text-[#DCCDCE]/20">
        Processing
      </div>

      <div className="absolute top-[76%] left-[72%] text-[10px] uppercase tracking-[0.35em] text-[#DCCDCE]/20">
        Consensus
      </div>

      <div className="absolute top-[48%] left-[88%] text-[10px] uppercase tracking-[0.35em] text-[#DCCDCE]/20">
        Settlement
      </div>

      {/* SVG Connections */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {nodes.map((node) => {
          const targets: string[] = [];

          if (
            ["user", "biometric", "transaction"].includes(node.id)
          ) {
            targets.push("edge");
          }

          if (node.id === "edge") targets.push("shamir");
          if (node.id === "shamir") targets.push("verification");
          if (node.id === "verification") targets.push("mpc");
          if (node.id === "mpc") targets.push("blockchain");

          if (node.id === "blockchain") {
            targets.push("contract");
            targets.push("did");
            targets.push("zkp");
            targets.push("bank-backend");
          }

          if (node.id === "bank-backend") {
            targets.push("bank-sub");
            targets.push("notification");
          }

          return targets.map((targetId) => {
            const target = nodes.find(
              (n) => n.id === targetId
            );

            if (!target) return null;

            const isDashed =
              ["shamir", "bank-sub"].includes(targetId);

            return (
              <g key={`${node.id}-${targetId}`}>
                {/* Base Path */}
                <path
                  d={createPath(
                    node.position.x,
                    node.position.y,
                    target.position.x,
                    target.position.y
                  )}
                  fill="none"
                  stroke="rgba(212,175,55,0.14)"
                  strokeWidth="1.4"
                  strokeDasharray={isDashed ? "5 5" : "none"}
                />

                {/* Animated Flow */}
                {!isDashed && (
                  <path
                    d={createPath(
                      node.position.x,
                      node.position.y,
                      target.position.x,
                      target.position.y
                    )}
                    fill="none"
                    stroke="rgba(212,175,55,0.55)"
                    strokeWidth="1.2"
                    strokeOpacity="0.12"
                    strokeDasharray="4 18"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      values="0;400"
                      dur="14s"
                      repeatCount="indefinite"
                    />
                  </path>
                )}
              </g>
            );
          });
        })}
      </svg>

      {/* Header */}
      <div className="relative z-20 mb-12 max-w-3xl">
        <div className="mb-5 inline-flex items-center rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-[#D4AF37]">
          Aarvasa Blockchain Infrastructure
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] leading-tight text-white">
          Institutional-grade blockchain orchestration
          for secure real estate settlement.
        </h2>

        <p className="mt-6 text-lg leading-relaxed text-[#DCCDCE]/52">
          Aarvasa combines MPC validation, smart contracts,
          decentralized identity, AI fraud analysis, and
          blockchain settlement infrastructure into a unified
          transaction engine for premium real estate investing.
        </p>
      </div>

      {/* Nodes */}
      <div className="relative h-[1000px] w-full mt-16">
        {nodes.map((node) => (
          <Node key={node.id} node={node} />
        ))}
      </div>

      {/* Legend */}
      <div className="relative z-20 mt-12 flex flex-wrap gap-6 text-[11px] uppercase tracking-[0.2em] text-[#DCCDCE]/45">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#D4AF37]" />
          Active Data Stream
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full border border-[#D4AF37]" />
          Encrypted Sub-process
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#50080E]" />
          Blockchain Verification
        </div>
      </div>
    </section>
  );
}