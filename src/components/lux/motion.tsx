"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Fragment, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * The motion vocabulary of the 2026 design.
 *
 * One curve for arrivals (a long, decelerating ease), springs for anything the
 * pointer touches. Every component renders its content plainly when the
 * visitor asks for reduced motion.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/* ── LuxHeading · words rise out of a mask, accents set in gold italic ──── */

/**
 * `text` may mark accent words with asterisks: "Know the *building* first."
 * Accent words are set in gold italic. Each word rises from behind a mask,
 * staggered, once, as the heading enters the viewport.
 */
export function LuxHeading({
  text,
  as: Tag = "h2",
  className,
  delay = 0,
  immediate = false,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
  /** Animate on mount rather than on entering the viewport (for heroes). */
  immediate?: boolean;
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  const plain = text.replace(/\*/g, "");
  const MotionTag = motion[Tag];

  const renderWord = (w: string) => {
    const accent = w.startsWith("*") || w.endsWith("*") || w.includes("*");
    const clean = w.replace(/\*/g, "");
    return accent ? <em className="lux-gold-text lux-shimmer font-normal italic">{clean}</em> : clean;
  };

  if (reduced) {
    return (
      <Tag className={className}>
        {words.map((w, i) => (
          <Fragment key={i}>
            {renderWord(w)}
            {i < words.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </Tag>
    );
  }

  const trigger = immediate
    ? { initial: "hidden", animate: "shown" }
    : { initial: "hidden", whileInView: "shown", viewport: { once: true, margin: "-80px" } };

  return (
    <MotionTag
      aria-label={plain}
      className={className}
      {...trigger}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}
    >
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className="inline-block will-change-transform"
            variants={{
              hidden: { y: "110%", rotate: 4 },
              shown: { y: "0%", rotate: 0, transition: { duration: 1.1, ease: EASE } },
            }}
          >
            {renderWord(w)}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/* ── FadeUp · the default arrival ─────────────────────────────────────── */

export function FadeUp({
  children,
  className,
  delay = 0,
  y = 32,
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  immediate?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  const trigger = immediate
    ? { animate: { opacity: 1, y: 0, filter: "blur(0px)" } }
    : { whileInView: { opacity: 1, y: 0, filter: "blur(0px)" }, viewport: { once: true, margin: "-60px" } };
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      {...trigger}
      transition={{ duration: 1, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Stagger · children arrive one after another ──────────────────────── */

export function Stagger({
  children,
  className,
  gap = 0.1,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 40, scale: 0.97 },
        shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Magnetic · a control that leans toward the pointer ───────────────── */

export function Magnetic({ children, className, strength = 0.35 }: { children: ReactNode; className?: string; strength?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });

  if (reduced) return <div className={cn("inline-block", className)}>{children}</div>;

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };

  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.div>
  );
}

/* ── Tilt · a card that turns toward the pointer, lit where it points ─── */

export function Tilt({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 160, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 160, damping: 20 });

  if (reduced) return <div className={className}>{children}</div>;

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    px.set(fx);
    py.set(fy);
    el.style.setProperty("--mx", `${fx * 100}%`);
    el.style.setProperty("--my", `${fy * 100}%`);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      className={cn("lux-spotlight", className)}
    >
      {children}
    </motion.div>
  );
}

/* ── ScrollProgress · a gold thread across the top of the page ────────── */

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-[linear-gradient(90deg,#b08a40,#f3e2b3,#d6b461)]"
    />
  );
}

/* ── ParallaxLayer · depth on scroll ──────────────────────────────────── */

export function ParallaxLayer({
  children,
  className,
  speed = 0.2,
}: {
  children: ReactNode;
  className?: string;
  /** Fraction of scroll distance the layer moves against. */
  speed?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${-speed * 100}%`, `${speed * 100}%`]);
  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div style={reduced ? undefined : { y }} className="absolute inset-[-12%_0]">
        {children}
      </motion.div>
    </div>
  );
}

/* ── useScrollRange · map a section's scroll to a value ───────────────── */

export function useSectionProgress(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return scrollYProgress;
}
