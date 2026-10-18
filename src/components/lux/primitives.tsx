import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FadeUp, LuxHeading, Magnetic } from "./motion";

/**
 * Static building blocks of the 2026 design. Server components where they can
 * be; the motion comes from ./motion.
 */

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1320px] px-[var(--gutter)]", className)}>{children}</div>;
}

/** Warm light drifting behind a section. Decorative. */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="lux-aurora" />
    </div>
  );
}

/** Fine grain over a dark ground, so large areas of colour do not band. */
export function Noise({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay", className)}
      style={{ backgroundImage: "url(/noise.png)", backgroundSize: "180px" }}
    />
  );
}

/** Eyebrow, rising headline, optional note on the right. */
export function SectionTitle({
  eyebrow,
  title,
  note,
  align = "left",
  className,
  as = "h2",
}: {
  eyebrow?: string;
  /** Asterisks mark the gold italic accent: "The *collection*". */
  title: string;
  note?: ReactNode;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2";
}) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-[var(--s-6)]",
        centered ? "items-center text-center" : "lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className={centered ? "flex flex-col items-center" : undefined}>
        {eyebrow && (
          <FadeUp y={12}>
            <span className="lux-eyebrow">{eyebrow}</span>
          </FadeUp>
        )}
        <LuxHeading
          as={as}
          text={title}
          className={cn(
            "av-display mt-4 text-[clamp(38px,5.4vw,76px)] font-light leading-[0.98] text-ink",
            centered ? "max-w-[18ch]" : "max-w-[16ch]",
          )}
        />
      </div>
      {note && (
        <FadeUp delay={0.2} className={cn("max-w-[42ch] text-[15px] leading-relaxed text-ink-muted", centered && "mx-auto")}>
          {note}
        </FadeUp>
      )}
    </div>
  );
}

/** The gold action. Magnetic on a pointer, a light crosses it on hover. */
export function GoldButton({
  href,
  children,
  className,
  external,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  const cls = cn(
    "av-gold group inline-flex items-center gap-3 rounded-full py-[15px] pl-7 pr-2 text-[13px] font-semibold uppercase tracking-[0.14em]",
    className,
  );
  const inner = (
    <>
      {children}
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a0e0f] text-gold transition-transform duration-500 group-hover:rotate-45">
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </>
  );
  return (
    <Magnetic>
      {external ? (
        <a href={href} className={cls}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      )}
    </Magnetic>
  );
}

/** The quiet action beside a gold one. */
export function GhostButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Magnetic strength={0.25}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-[var(--glass-rule)] bg-white/[0.03] px-7 py-[15px] text-[13px] font-semibold uppercase tracking-[0.14em] text-ink backdrop-blur-md transition-colors duration-300 hover:border-gold hover:text-gold",
          className,
        )}
      >
        {children}
      </Link>
    </Magnetic>
  );
}

/** Words or marks moving past, doubled for a seamless loop. Decorative. */
export function Marquee({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-24 bg-gradient-to-r from-[var(--paper)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-24 bg-gradient-to-l from-[var(--paper)] to-transparent" />
      <div className="lux-marquee flex w-max items-center gap-14">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-14">
            {item}
            <span className="h-1.5 w-1.5 rotate-45 bg-gold/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A glass chip with a small label and a value — used over imagery. */
export function StatChip({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("lux-glass rounded-2xl px-5 py-4", className)}>
      <div className="av-display text-[34px] leading-none text-ink">{value}</div>
      <div className="av-meta mt-2 text-[10px] text-ink-muted">{label}</div>
    </div>
  );
}
