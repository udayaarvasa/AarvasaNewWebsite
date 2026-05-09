"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Banknote,
  Bell,
  Blocks,
  BrainCircuit,
  Cpu,
  Fingerprint,
  Loader2,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const steps = [
  { label: "User", icon: Fingerprint },
  { label: "Biometric", icon: BadgeCheck },
  { label: "Edge Processor", icon: Cpu },
  { label: "MPC Nodes", icon: Network },
  { label: "Blockchain", icon: Blocks },
  { label: "Bank Backend", icon: Banknote },
  { label: "Notification", icon: Bell },
];

export function BlockchainFlow() {
  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState("");
  const [status, setStatus] = useState("ready");

  async function simulate() {
    setLoading(true);
    const response = await fetch("/api/blockchain/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: "goa-cliff-villas", amount: 2500000 }),
    });
    const data = await response.json();
    setHash(data.transaction.hash);
    setStatus(data.transaction.status);
    setLoading(false);

    window.setTimeout(async () => {
      const statusResponse = await fetch(`/api/blockchain/status?hash=${data.transaction.hash}`);
      const statusData = await statusResponse.json();
      setStatus(statusData.transaction.status);
    }, 5200);
  }

  return (
    <Card className="overflow-hidden bg-[#0b0b0b] p-6 text-white">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge>Secure Transaction Flow</Badge>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            User to verified settlement, visualized.
          </h2>
        </div>
        <Button onClick={simulate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
          Simulate Transaction
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-primary/25 bg-white/[0.06] p-4 shadow-[0_0_50px_rgba(212,175,55,0.12)] backdrop-blur-xl"
              >
                <div className="gold-gradient mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {index === 0
                    ? "Initiates escrow"
                    : index === 6
                      ? "Investor notified"
                      : "Verified packet"}
                </p>
              </motion.div>
              {index < steps.length - 1 ? (
                <motion.div
                  aria-hidden="true"
                  className="absolute left-[calc(100%-4px)] top-1/2 hidden h-px w-8 bg-gradient-to-r from-primary to-transparent lg:block"
                  animate={{ opacity: [0.25, 1, 0.25], scaleX: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.12 }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Transaction Hash</p>
          <p className="mt-2 break-all font-mono text-sm text-primary">{hash || "Not generated"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Status</p>
          <p className="mt-2 text-lg font-semibold capitalize text-white">{status}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Smart Contract</p>
          <p className="mt-2 font-mono text-sm text-white">AARVASA_ESCROW_V1</p>
        </div>
      </div>
    </Card>
  );
}
