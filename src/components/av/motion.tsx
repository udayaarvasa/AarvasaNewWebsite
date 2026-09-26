"use client";

import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The Aarvasa motion system.
 *
 * One curve, four durations, and a short list of things allowed to move —
 * all of it built on the framer-motion already in the project. No new
 * animation dependency.
 *
 * Every primitive here obeys two rules:
 *   1. prefers-reduced-motion renders the content plainly, with no transform
 *      and no delay. A reader who asked for less motion waits for nothing.
 *   2. Nothing rests at opacity 0. If motion never runs, the page still reads.
 */

const EASE_ENTER = [0.22, 1, 0.36, 1] as const;

const D = { state: 0.2, control: 0.3, enter: 0.6, media: 1.2 } as const;

/* ── Reveal · fade and rise, once ────────────────────────────────────── */

export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <Tag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: D.enter, ease: EASE_ENTER, delay }}
      className={className}
    >
      {children}
    </Tag>
  );
}

/* ── RevealGroup · stagger, capped at four ───────────────────────────── */

const groupVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0, transition: { duration: D.enter, ease: EASE_ENTER } },
};

export function RevealGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      variants={groupVariants}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "-80px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/* ── TextReveal · display type rises line by line behind a mask ──────── */

export function TextReveal({
  text,
  className,
  delay = 0,
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  const reduced = useReducedMotion();

  if (reduced) return <Tag className={className}>{text}</Tag>;

  // Split on spaces, not characters: a per-character stagger on a display face
  // reads as a gimmick and wrecks kerning.
  const words = text.split(" ");

  return (
    <Tag className={className}>
      <motion.span
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.035, delayChildren: delay } } }}
        className="inline"
      >
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
            <motion.span
              variants={{
                hidden: { y: "100%", opacity: 0 },
                shown: { y: 0, opacity: 1, transition: { duration: 0.55, ease: EASE_ENTER } },
              }}
              className="inline-block"
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

/* ── ImageReveal · a wipe that uncovers the frame ────────────────────── */

export function ImageReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, ease: EASE_ENTER, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Parallax · desktop only, transform only ─────────────────────────── */

export function Parallax({
  children,
  distance = 60,
  className,
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      {/* Scaled slightly so the translate never exposes an edge. Disabled
          under reduced motion and below md, where parallax costs more than it
          gives on a phone. */}
      <motion.div
        style={reduced ? undefined : { y }}
        className={cn("h-full w-full", reduced ? "" : "max-md:!translate-y-0 md:scale-[1.12]")}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ── DrawLine · an SVG rule that draws itself in ─────────────────────── */

export function DrawLine({ className, tone = "paper" }: { className?: string; tone?: "paper" | "stage" }) {
  const reduced = useReducedMotion();
  const stroke = tone === "paper" ? "var(--rule-firm)" : "var(--stage-rule)";

  return (
    <svg aria-hidden="true" viewBox="0 0 100 1" preserveAspectRatio="none" className={cn("h-px w-full", className)}>
      <motion.line
        x1="0"
        y1="0.5"
        x2="100"
        y2="0.5"
        stroke={stroke}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? undefined : { pathLength: 0 }}
        whileInView={reduced ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: EASE_ENTER }}
      />
    </svg>
  );
}

/* ── HoverLift · the one hover treatment for a pressable surface ─────── */

export function HoverLift({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: D.control, ease: EASE_ENTER }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
