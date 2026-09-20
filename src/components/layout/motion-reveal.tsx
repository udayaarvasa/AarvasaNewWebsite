"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Scroll reveal: fade and a 20px rise, once, on the design language's entrance
 * curve.
 *
 * Two rules it now honours. Under prefers-reduced-motion nothing translates
 * and nothing animates — the content is simply rendered, because a reader who
 * has asked for less motion should not have to wait for any. And the resting
 * state is never opacity 0 for a reader who cannot run the animation, so the
 * page reads even if motion never starts.
 */
export function MotionReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
