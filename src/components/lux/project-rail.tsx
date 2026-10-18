"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
 * The listed projects as a slider: arrows, drag with the mouse, swipe on a
 * trackpad or phone, and a progress line that follows the position.
 * Snaps card to card. Keyboard: the arrows are buttons, the row is focusable.
 */
export function ProjectRail({ projects }: { projects: RailProject[] }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft > max - 8);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-rail-card]");
    const by = card ? card.offsetWidth + 32 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * by, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <div className="mx-auto mb-8 flex max-w-[1320px] items-center justify-end gap-3 px-[var(--gutter)]">
        <span className="av-meta mr-auto text-[10px] text-ink-muted">Drag, swipe or use the arrows</span>
        {[-1, 1].map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => step(dir as 1 | -1)}
            disabled={dir === -1 ? atStart : atEnd}
            aria-label={dir === -1 ? "Previous projects" : "Next projects"}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--glass-rule)] text-ink transition-all duration-300 hover:border-gold hover:bg-gold hover:text-[#3a0509] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
          >
            {dir === -1 ? <ArrowLeft className="h-5 w-5" aria-hidden="true" /> : <ArrowRight className="h-5 w-5" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label="Listed projects"
        onScroll={update}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !ref.current) return;
          drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !ref.current) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) d.moved = true;
          ref.current.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          // Let a click that dragged not open a card.
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerLeave={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.preventDefault();
        }}
        className="flex snap-x snap-mandatory gap-8 overflow-x-auto scroll-smooth pb-4 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingInline: "max(var(--gutter), calc((100vw - 1320px) / 2 + var(--gutter)))", scrollPaddingInline: "max(var(--gutter), calc((100vw - 1320px) / 2 + var(--gutter)))" }}
      >
        {projects.map((p, i) => (
          <div key={p.slug} data-rail-card className="shrink-0 snap-start">
            <RailCard project={p} index={i} />
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 h-px w-[min(320px,70vw)] bg-white/10">
        <motion.div style={{ scaleX: Math.max(0.08, progress) }} className="h-full origin-left bg-gold transition-transform duration-300" />
      </div>
    </div>
  );
}

function RailCard({ project: p, index }: { project: RailProject; index: number }) {
  return (
    <Tilt className="w-[80vw] max-w-[420px] rounded-[28px] sm:w-[400px]">
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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#4f060c,#0c0909_70%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,5,5,0)_40%,rgba(7,5,5,0.92)_100%)]" />
          <span className="av-meta absolute left-5 top-5 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] text-stage-ink backdrop-blur-md">
            {String(index + 1).padStart(2, "0")} · {p.status}
          </span>
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
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 text-gold transition-all duration-500 group-hover:rotate-45 group-hover:bg-gold group-hover:text-[#3a0509]">
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </Tilt>
  );
}
