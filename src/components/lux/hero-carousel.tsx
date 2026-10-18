"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE } from "./motion";

export type HeroSlide = {
  src: string;
  alt: string;
  /** What the frame is, shown in the corner — a render must say so. */
  caption: string;
  /** Where the eye should rest when the frame is cropped. */
  position?: string;
};

/**
 * Full-bleed crossfading frames with a slow push-in on each, and a row of
 * progress hairlines that double as controls. Pauses for reduced motion.
 */
export function HeroCarousel({ slides, interval = 6500 }: { slides: HeroSlide[]; interval?: number }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || slides.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => window.clearInterval(id);
  }, [reduced, slides.length, interval, index]);

  const slide = slides[index];
  if (!slide) return null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-stage">
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.src}
          className="absolute inset-0"
          initial={reduced ? false : { opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1.02 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.6, ease: EASE }, scale: { duration: interval / 1000 + 1.6, ease: "linear" } }}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: slide.position ?? "50% 50%" }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Depth: a dark floor for the type, warm vignette at the edges */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,5,5,0.55)_0%,rgba(7,5,5,0.15)_30%,rgba(7,5,5,0.35)_60%,rgba(7,5,5,0.96)_100%)]" />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,5,5,0.82)_0%,rgba(7,5,5,0.45)_45%,rgba(7,5,5,0)_75%)]" />
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_60%,transparent_30%,rgba(79,6,12,0.55)_100%)]" />

      <div className="absolute bottom-[var(--s-8)] right-[var(--gutter)] z-[4] flex flex-col items-end gap-3">
        <AnimatePresence mode="wait">
          <motion.span
            key={slide.caption}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            className="av-meta rounded-full border border-[var(--glass-rule)] bg-black/40 px-3 py-1.5 text-stage-ink backdrop-blur-md"
          >
            {slide.caption}
          </motion.span>
        </AnimatePresence>
        {slides.length > 1 && (
          <div className="flex gap-2" role="tablist" aria-label="Hero images">
            {slides.map((s, i) => (
              <button
                key={s.src}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show image ${i + 1}: ${s.caption}`}
                onClick={() => setIndex(i)}
                className="relative h-[3px] w-10 overflow-hidden rounded-full bg-white/20"
              >
                {i === index && (
                  <motion.span
                    key={`bar-${index}`}
                    className="absolute inset-y-0 left-0 bg-gold"
                    initial={{ width: reduced ? "100%" : "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: reduced ? 0 : interval / 1000, ease: "linear" }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
