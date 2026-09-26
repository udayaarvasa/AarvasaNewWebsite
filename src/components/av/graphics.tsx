import { cn } from "@/lib/utils";

/**
 * Aarvasa architectural graphics.
 *
 * A reusable decorative language drawn from drafting conventions: fine grids,
 * coordinate ticks, corner brackets, contour lines, measurement rules and
 * abstract elevation/plan geometry.
 *
 * Every graphic here is DECORATIVE BRAND ARTWORK. None of it depicts a real
 * building, and none of it is presented as a technical drawing of a property —
 * the actual layout plans are photographs of the developer's own filed
 * drawings and live on the project pages, clearly labelled.
 *
 * All are server-safe, pure SVG/CSS, aria-hidden and pointer-events-none, so
 * they cost nothing in JavaScript and never intercept a click.
 */

type Tone = "paper" | "stage";

/* The grid is a whisper. Drawn motifs need more weight or they read as a
   rendering artefact rather than deliberate line work. */
const STROKE: Record<Tone, string> = {
  paper: "var(--rule-firm)",
  stage: "var(--stage-rule)",
};

const INK: Record<Tone, string> = {
  paper: "var(--ink-disabled)",
  stage: "#6f6558",
};

const ACCENT: Record<Tone, string> = {
  paper: "var(--gold-ink)",
  stage: "var(--gold)",
};

/* ── Drafting grid ───────────────────────────────────────────────────────
   A fine square grid with coordinate ticks, faded out toward the edges so it
   reads as paper texture rather than a table. */

export function DraftingGrid({
  tone = "paper",
  size = 48,
  className,
  fade = "radial",
}: {
  tone?: Tone;
  size?: number;
  className?: string;
  fade?: "radial" | "top" | "bottom" | "none";
}) {
  const mask =
    fade === "radial"
      ? "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 100%)"
      : fade === "top"
        ? "linear-gradient(to bottom, #000, transparent 75%)"
        : fade === "bottom"
          ? "linear-gradient(to top, #000, transparent 75%)"
          : undefined;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: `linear-gradient(to right, ${STROKE[tone]} 1px, transparent 1px), linear-gradient(to bottom, ${STROKE[tone]} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        opacity: tone === "paper" ? 0.35 : 0.55,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}

/* ── Corner brackets ─────────────────────────────────────────────────────
   The reticle. It means one thing only: this media is navigable. */

export function CornerBrackets({
  tone = "stage",
  inset = 14,
  size = 16,
  className,
}: {
  tone?: Tone;
  inset?: number;
  size?: number;
  className?: string;
}) {
  const corners = [
    "top-0 left-0 border-r-0 border-b-0",
    "top-0 right-0 border-l-0 border-b-0",
    "bottom-0 left-0 border-r-0 border-t-0",
    "bottom-0 right-0 border-l-0 border-t-0",
  ];
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute z-[2]", className)}
      style={{ inset }}
    >
      {corners.map((pos) => (
        <i
          key={pos}
          className={cn("absolute block border opacity-90", pos)}
          style={{ width: size, height: size, borderColor: ACCENT[tone] }}
        />
      ))}
    </span>
  );
}

/* ── Contour field ───────────────────────────────────────────────────────
   Nested offset curves, the way a site survey draws a slope. Abstract: it
   describes no real terrain. */

export function ContourField({
  tone = "paper",
  lines = 9,
  className,
  seed = 1,
}: {
  tone?: Tone;
  lines?: number;
  className?: string;
  seed?: number;
}) {
  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const t = i / lines;
    const y = 120 + t * 300;
    const amp = 46 - t * 22;
    const shift = ((seed * 37 + i * 53) % 60) - 30;
    paths.push(
      `M-20 ${y} C ${180 + shift} ${y - amp}, ${420 - shift} ${y + amp}, ${620} ${y - amp * 0.5} S ${1000 + shift} ${y + amp}, ${1220} ${y - amp * 0.3}`,
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 560"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={INK[tone]}
          strokeWidth={i % 3 === 0 ? 1.2 : 0.7}
          opacity={tone === "paper" ? 0.55 : 0.75}
        />
      ))}
    </svg>
  );
}

/* ── Elevation motif ─────────────────────────────────────────────────────
   Stacked floor plates and bay rhythm, drawn as line work. A brand graphic
   about buildings in general — never captioned as a specific project. */

export function ElevationMotif({
  tone = "paper",
  storeys = 14,
  className,
  accentRow = 4,
}: {
  tone?: Tone;
  storeys?: number;
  className?: string;
  accentRow?: number;
}) {
  const W = 400;
  const H = 560;
  const ground = 520;
  const fh = Math.max(9, Math.min(22, Math.floor(360 / storeys)));
  const podium = 30;
  const bw = 176;
  const x0 = (W - bw) / 2;
  const top = ground - podium - storeys * fh;

  const rows = Array.from({ length: storeys }, (_, i) => ground - podium - (i + 1) * fh);
  const bays = 5;
  const line = INK[tone];

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax meet"
      className={cn("pointer-events-none h-full w-full", className)}
    >
      {/* podium + shaft */}
      <rect x={x0 - 34} y={ground - podium} width={bw + 68} height={podium} fill="none" stroke={line} strokeWidth="1.1" />
      <rect x={x0} y={top} width={bw} height={storeys * fh} fill="none" stroke={line} strokeWidth="1.1" />

      {/* floor plates */}
      {rows.map((y, i) => (
        <line
          key={y}
          x1={x0}
          y1={y}
          x2={x0 + bw}
          y2={y}
          stroke={i === accentRow ? ACCENT[tone] : line}
          strokeWidth={i % 4 === 0 ? 1.1 : 0.5}
          opacity={i === accentRow ? 0.95 : 0.7}
        />
      ))}

      {/* bay rhythm */}
      {Array.from({ length: bays - 1 }, (_, i) => x0 + (bw / bays) * (i + 1)).map((x) => (
        <line key={x} x1={x} y1={top} x2={x} y2={ground - podium} stroke={line} strokeWidth="0.6" opacity="0.6" />
      ))}

      {/* crown, ground line and a measuring stick */}
      <line x1={x0 - 8} y1={top} x2={x0 + bw + 8} y2={top} stroke={line} strokeWidth="1.6" />
      <line x1="14" y1={ground} x2={W - 14} y2={ground} stroke={line} strokeWidth="1.4" />
      <line x1={x0 - 50} y1={top} x2={x0 - 50} y2={ground} stroke={line} strokeWidth="0.7" opacity="0.85" />
      <line x1={x0 - 55} y1={top} x2={x0 - 45} y2={top} stroke={line} strokeWidth="0.7" opacity="0.85" />
      <line x1={x0 - 55} y1={ground} x2={x0 - 45} y2={ground} stroke={line} strokeWidth="0.7" opacity="0.85" />
    </svg>
  );
}

/* ── Plan motif ──────────────────────────────────────────────────────────
   Abstract spatial geometry in the manner of a floor plan: rooms, a
   circulation spine, a threshold. Not a plan of anything. */

export function PlanMotif({ tone = "paper", className }: { tone?: Tone; className?: string }) {
  const s = INK[tone];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 480 360"
      preserveAspectRatio="xMidYMid meet"
      className={cn("pointer-events-none h-full w-full", className)}
    >
      <g fill="none" stroke={s} strokeWidth="1.1">
        <rect x="40" y="40" width="400" height="280" />
        <line x1="40" y1="170" x2="250" y2="170" />
        <line x1="250" y1="40" x2="250" y2="320" />
        <line x1="250" y1="230" x2="440" y2="230" />
        <rect x="70" y="70" width="140" height="72" strokeWidth="0.6" opacity="0.75" />
        <rect x="70" y="200" width="140" height="90" strokeWidth="0.6" opacity="0.75" />
        <rect x="285" y="70" width="120" height="120" strokeWidth="0.6" opacity="0.75" />
      </g>
      {/* threshold swing and a datum mark */}
      <path d="M250 120 A 34 34 0 0 1 284 154" fill="none" stroke={ACCENT[tone]} strokeWidth="1" opacity="0.9" />
      <circle cx="250" cy="120" r="2.5" fill={ACCENT[tone]} />
      <g stroke={s} strokeWidth="0.6" opacity="0.8">
        <line x1="40" y1="340" x2="440" y2="340" />
        <line x1="40" y1="335" x2="40" y2="345" />
        <line x1="440" y1="335" x2="440" y2="345" />
      </g>
    </svg>
  );
}

/* ── Measurement rule ────────────────────────────────────────────────────
   A drafting tick rule, used as a horizontal divider between bands. */

export function MeasureRule({
  tone = "paper",
  className,
  ticks = 48,
}: {
  tone?: Tone;
  className?: string;
  ticks?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${ticks * 10} 14`}
      preserveAspectRatio="none"
      className={cn("pointer-events-none h-[14px] w-full", className)}
    >
      <line x1="0" y1="13" x2={ticks * 10} y2="13" stroke={INK[tone]} strokeWidth="1" />
      {Array.from({ length: ticks + 1 }, (_, i) => (
        <line
          key={i}
          x1={i * 10}
          y1={i % 5 === 0 ? 4 : 8}
          x2={i * 10}
          y2="13"
          stroke={i % 5 === 0 ? ACCENT[tone] : INK[tone]}
          strokeWidth={i % 5 === 0 ? 0.9 : 0.6}
          opacity={i % 5 === 0 ? 0.85 : 0.6}
        />
      ))}
    </svg>
  );
}

/* ── Grain ───────────────────────────────────────────────────────────────
   The brand's own noise plate, kept under 8% so large flat fields and
   gradients stop banding without the paper turning grey. */

export function Grain({ opacity = 0.05, className }: { opacity?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 bg-repeat mix-blend-overlay", className)}
      style={{ backgroundImage: "url('/noise.png')", opacity }}
    />
  );
}

/* ── Section index ───────────────────────────────────────────────────────
   A numbered marker in the drafting voice. Only used where the sequence is
   real — a page's own section order. */

export function SectionIndex({
  n,
  total,
  tone = "paper",
  className,
}: {
  n: number;
  total: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "av-meta inline-flex items-center gap-2",
        tone === "paper" ? "text-ink-muted" : "text-stage-muted",
        className,
      )}
    >
      <span style={{ color: ACCENT[tone] }}>{String(n).padStart(2, "0")}</span>
      <span aria-hidden="true" className="inline-block h-px w-6" style={{ background: STROKE[tone] }} />
      <span>{String(total).padStart(2, "0")}</span>
    </span>
  );
}

/* ── Coordinate marks ────────────────────────────────────────────────────
   Small crosshairs placed at the corners of a band, the way a drawing sheet
   carries registration marks. */

export function CoordinateMarks({ tone = "paper", className }: { tone?: Tone; className?: string }) {
  const s = STROKE[tone];
  const mark = (x: string, y: string) => (
    <span key={`${x}${y}`} className="absolute" style={{ [x]: 18, [y]: 18 } as React.CSSProperties}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <line x1="6" y1="0" x2="6" y2="12" stroke={s} strokeWidth="0.8" />
        <line x1="0" y1="6" x2="12" y2="6" stroke={s} strokeWidth="0.8" />
      </svg>
    </span>
  );
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-[1]", className)}>
      {mark("left", "top")}
      {mark("right", "top")}
      {mark("left", "bottom")}
      {mark("right", "bottom")}
    </span>
  );
}
