"use client";

import { motion } from "framer-motion";
import { Eye, Rotate3d, Smartphone, Glasses } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";

const features = [
  { icon: Eye, title: "360° Virtual Tours", description: "Explore every room in immersive detail from anywhere." },
  { icon: Rotate3d, title: "3D Floor Plans", description: "Interactive models with accurate measurements." },
  { icon: Smartphone, title: "AR Room Preview", description: "Visualize renovations through your phone camera." },
  { icon: Glasses, title: "VR Walkthrough", description: "Full VR headset support for immersive experience." },
];

export function ARVRShowcase() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" id="ar-vr">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-glass">
        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[400px] overflow-hidden bg-gradient-to-br from-[#240914] via-[#481123] to-[#7a1f3d] p-10 lg:p-14">
            <motion.div animate={{ y: [-8, 8, -8], rotateZ: [-2, 2, -2] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute left-[10%] top-[20%] h-32 w-48 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl" />
            <motion.div animate={{ y: [6, -6, 6] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} className="absolute bottom-[15%] right-[15%] h-28 w-44 rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/10 backdrop-blur-xl" />
            <motion.div animate={{ y: [4, -8, 4], scale: [1, 1.05, 1] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute right-[30%] top-[40%] h-40 w-56 rounded-3xl border border-white/15 bg-white/8 shadow-2xl backdrop-blur-xl" />
            <div className="relative z-10 flex h-full flex-col justify-end">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                <Eye className="h-4 w-4 text-[#d4af37]" /> Coming Soon
              </span>
              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
                Experience Properties in <span className="gold-text">Another Dimension</span>
              </h2>
              <p className="mt-3 max-w-md text-base text-white/60">Step inside your future home before you buy.</p>
            </div>
          </div>
          <div className="p-10 lg:p-14">
            <div className="space-y-6">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <MotionReveal key={f.title} delay={i * 0.1}>
                    <div className="group flex gap-5 rounded-xl border border-transparent p-4 transition-all duration-300 hover:border-border hover:bg-muted/30">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7a1f3d] to-[#d4af37] text-white"><Icon className="h-6 w-6" /></div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">{f.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                      </div>
                    </div>
                  </MotionReveal>
                );
              })}
            </div>
            <div className="mt-8 px-4">
              <Button className="w-full" disabled><Glasses className="h-4 w-4" /> Early Access — Join Waitlist</Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Beta launching Q3 2025 • WebXR compatible</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
