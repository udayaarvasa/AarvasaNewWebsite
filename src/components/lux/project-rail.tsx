"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useRef } from "react";
import { Tilt } from "./motion";

export type RailProject = {
  slug: string;
  name: string;
  place: string;
  price: string;
  priceNote: string | null;
  status: string;
  image: string | null;
  imageNote: string | null;
};

/**
 * The listed projects as a rail that moves sideways while the page scrolls
 * down — pinned on wide screens, an ordinary swipeable row on narrow ones
 * and under reduced motion.
 */
export function ProjectRail({ projects }: { projects: RailProject[] }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Travel far enough that the last card ends at the right edge.
  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${Math.max(0, projects.length - 2.4) * 26}%`]);

  const cards = projects.map((p, i) => <RailCard key={p.slug} project={p} index={i} />);

  if (reduced) {
    return <div className="flex snap-x gap-6 overflow-x-auto px-[var(--gutter)] pb-6">{cards}</div>;
  }

  return (
    <>
      {/* Narrow screens: a swipeable row */}
      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-[var(--gutter)] pb-6 lg:hidden">{cards}</div>

      {/* Wide screens: pinned, driven by scroll */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${Math.max(160, projects.length * 46)}vh` }}>
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <motion.div style={{ x }} className="flex gap-8 pl-[max(var(--gutter),calc((100vw-1320px)/2+var(--gutter)))]">
            {cards}
          </motion.div>
          <div className="absolute bottom-10 left-1/2 h-px w-[240px] -translate-x-1/2 bg-white/10">
            <motion.div style={{ scaleX: scrollYProgress }} className="h-full origin-left bg-gold" />
          </div>
        </div>
      </div>
    </>
  );
}

function RailCard({ project: p, index }: { project: RailProject; index: number }) {
  return (
    <Tilt className="w-[82vw] max-w-[440px] shrink-0 snap-start rounded-[28px] sm:w-[420px]">
      <Link
        href={`/projects/${p.slug}`}
        className="group lux-gold-border block overflow-hidden rounded-[28px] bg-paper-raised"
      >
        <div className="relative aspect-[4/5] overflow-hidden">
          {p.image ? (
            <Image
              src={p.image}
              alt={`${p.name}, ${p.place}`}
              fill
              sizes="440px"
              className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#3d0c10,#0c0909_70%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,5,5,0)_40%,rgba(7,5,5,0.92)_100%)]" />
          <span className="av-meta absolute left-5 top-5 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] text-stage-ink backdrop-blur-md">
            {String(index + 1).padStart(2, "0")} · {p.status}
          </span>
          {p.imageNote && (
            <span className="av-meta absolute right-5 top-5 rounded-full bg-black/35 px-3 py-1.5 text-[10px] text-stage-muted backdrop-blur-md">
              {p.imageNote}
            </span>
          )}
          <div className="absolute inset-x-6 bottom-6">
            <h3 className="av-display text-[42px] font-normal leading-none text-stage-ink">{p.name}</h3>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-stage-muted">
              <MapPin className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> {p.place}
            </p>
            <div className="mt-5 flex items-end justify-between border-t border-white/15 pt-4">
              <div>
                <div className="av-meta text-[10px] text-stage-muted">From</div>
                <div className="mt-1 text-[20px] font-semibold text-gold-pale">{p.price}</div>
                {p.priceNote && <div className="text-[12px] text-stage-muted">{p.priceNote}</div>}
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 text-gold transition-all duration-500 group-hover:rotate-45 group-hover:bg-gold group-hover:text-[#1a0e0f]">
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </Tilt>
  );
}
