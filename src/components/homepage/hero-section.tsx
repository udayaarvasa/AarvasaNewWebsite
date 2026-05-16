"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  HomeIcon,
  IndianRupee,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "./animated-counter";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const stats = [
  { value: 2500, suffix: "+", label: "Properties Listed" },
  { value: 12, prefix: "₹", suffix: "B+", label: "Portfolio Value" },
  { value: 98, suffix: "%", label: "Investor Satisfaction" },
  { value: 15, suffix: "%", decimals: 1, label: "Avg Annual ROI" },
];

const cubicEase = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: cubicEase as unknown as [number, number, number, number],
      delay: i * 0.12,
    },
  }),
};

export function HeroSection() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [budget, setBudget] = useState("");
  const [aiMode, setAiMode] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (aiMode) {
      const prompt = `Best ${propertyType || "property"} investment${budget ? ` under ${budget}` : ""}${location ? ` in ${location}` : ""}`;
      router.push(`/ai-chat?prompt=${encodeURIComponent(prompt)}`);
    } else {
      router.push("/listings");
    }
  }

  return (
    <section className="relative min-h-screen overflow-hidden" id="hero">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Multi-layer gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#240914]/90 via-[#481123]/70 to-[#0b0b0b]/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#240914]/80 via-transparent to-[#0b0b0b]/40" />
        {/* Subtle radial glow */}
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4af37]/8 blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <div className="max-w-4xl">


          {/* Headline */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-8 text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[5.5rem]"
          >
            Discover Your{" "}
            <span className="gold-text">Legacy Estate</span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-6 max-w-2xl text-xl leading-relaxed text-white/70"
          >
            Where artificial intelligence meets luxury real estate. 
            Unlock data-driven investment insights, blockchain-verified 
            transactions, and curated properties tailored to your vision.
          </motion.p>

          {/* Search Bar */}
          <motion.form
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            onSubmit={onSubmit}
            className="mt-10 max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_32px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="flex h-14 items-center gap-3 rounded-xl bg-white/10 px-4 transition-colors focus-within:bg-white/15">
                <MapPin className="h-5 w-5 shrink-0 text-[#d4af37]" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/50"
                  placeholder="City, locality, or project"
                />
              </label>
              <label className="flex h-14 items-center gap-3 rounded-xl bg-white/10 px-4 transition-colors focus-within:bg-white/15">
                <HomeIcon className="h-5 w-5 shrink-0 text-[#d4af37]" />
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-white/80 outline-none"
                >
                  <option value="" className="text-black">Property Type</option>
                  <option value="Villa" className="text-black">Villa</option>
                  <option value="Apartment" className="text-black">Apartment</option>
                  <option value="Office" className="text-black">Office</option>
                  <option value="Land" className="text-black">Land</option>
                </select>
              </label>
              <label className="flex h-14 items-center gap-3 rounded-xl bg-white/10 px-4 transition-colors focus-within:bg-white/15">
                <IndianRupee className="h-5 w-5 shrink-0 text-[#d4af37]" />
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-white/80 outline-none"
                >
                  <option value="" className="text-black">Budget Range</option>
                  <option value="50L" className="text-black">Under ₹50L</option>
                  <option value="1Cr" className="text-black">₹50L – ₹1Cr</option>
                  <option value="3Cr" className="text-black">₹1Cr – ₹3Cr</option>
                  <option value="5Cr" className="text-black">₹3Cr – ₹5Cr</option>
                  <option value="5Cr+" className="text-black">₹5Cr+</option>
                </select>
              </label>
              <Button
                type="submit"
                variant="gold"
                className="h-14 gap-2 rounded-xl px-6 text-base font-bold"
              >
                <Search className="h-5 w-5" />
                Search
              </Button>
            </div>
            {/* AI Toggle */}
            <div className="mt-2 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setAiMode(!aiMode)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition hover:text-white/90"
              >
                <span
                  className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                    aiMode ? "bg-[#d4af37]" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      aiMode ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
                <Sparkles className={`h-3.5 w-3.5 ${aiMode ? "text-[#d4af37]" : ""}`} />
                AI-Powered Recommendations
              </button>
              <span className="text-xs text-white/40">
                {aiMode ? "AI will analyze your criteria" : "Standard search"}
              </span>
            </div>
          </motion.form>
        </div>

        {/* Stats Bar */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-16 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/8 bg-white/5 px-5 py-5 backdrop-blur-sm"
            >
              <p className="text-3xl font-black text-white">
                <AnimatedCounter
                  end={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  decimals={stat.decimals}
                />
              </p>
              <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.15em] text-white/50">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>


    </section>
  );
}
