import { cn } from "@/lib/utils";

/**
 * Aarvasa design-language primitives.
 *
 * Server-safe and presentational only. These exist so pages stop hand-rolling
 * the same hairline, ledger row and eyebrow; anything that recurs across two
 * surfaces belongs here rather than in a page.
 */

/* ── Page container ──────────────────────────────────────────────────────── */

export function Wrap({
  children,
  className,
  read = false,
}: {
  children: React.ReactNode;
  className?: string;
  read?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-[var(--gutter)]",
        read ? "max-w-[calc(var(--measure)+var(--gutter)*2)]" : "max-w-[var(--container)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Section heading: eyebrow, optional title, optional right note ───────── */

export function SectionHead({
  label,
  title,
  note,
  className,
}: {
  label: string;
  title?: string;
  note?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-[var(--s-10)] flex flex-wrap items-end justify-between gap-[var(--s-6)] border-t border-rule-firm pt-[var(--s-4)]",
        className,
      )}
    >
      <div className="max-w-[46ch]">
        <span className="av-label text-gold-ink">{label}</span>
        {title && (
          <h2 className="av-display mt-2 text-[clamp(26px,3vw,38px)] leading-[1.05]">{title}</h2>
        )}
      </div>
      {note && <p className="max-w-[34ch] text-[13px] leading-relaxed text-ink-muted sm:text-right">{note}</p>}
    </div>
  );
}

/* ── Ledger: specification set as a drawing schedule ─────────────────────── */

export type LedgerRow = { term: string; value: React.ReactNode };

export function Ledger({ rows, className }: { rows: LedgerRow[]; className?: string }) {
  if (rows.length === 0) return null;
  return (
    <dl className={cn("border-t border-rule", className)}>
      {rows.map((row, i) => (
        <div
          key={`${row.term}-${i}`}
          className="grid grid-cols-[110px_minmax(0,1fr)] gap-[var(--s-4)] border-b border-rule py-[11px] text-[13.5px] sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-[var(--s-5)] lg:grid-cols-[150px_minmax(0,1fr)]"
        >
          <dt className="min-w-0 break-words text-ink-muted">{row.term}</dt>
          <dd className="av-num min-w-0 break-words font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Metadata rail: the strip of headline figures under a hero ───────────── */

export function RailStrip({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-wrap border-t border-rule-firm border-b-rule border-b">
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className="mr-[var(--s-5)] flex-1 basis-[150px] border-r border-rule py-[var(--s-4)] pr-[var(--s-5)] last:mr-0 last:border-r-0 max-sm:mr-0 max-sm:basis-[44%] max-sm:border-r-0 max-sm:pr-0"
        >
          <dt className="av-label text-ink-muted">{item.label}</dt>
          <dd className="av-num av-display mt-1 text-[22px] leading-tight">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Capability mark ──────────────────────────────────────────────────────
   Produced formats only. A format with no asset is omitted, never rendered as
   a dead control. */

export function CapMark({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "av-meta rounded-xs border px-[7px] py-[3px]",
        muted ? "border-rule border-dashed text-ink-disabled" : "border-rule-firm text-ink",
      )}
    >
      {children}
    </span>
  );
}

/* ── Status: semantic, never the accent ──────────────────────────────────── */

export function Status({ tone, children }: { tone: "ready" | "pending"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-xs border px-[7px] py-[4px] text-[10.5px] font-semibold tracking-[0.04em]",
        tone === "ready"
          ? "border-positive/40 bg-positive/[0.07] text-positive"
          : "border-pending/40 bg-pending/[0.07] text-pending",
      )}
    >
      {children}
    </span>
  );
}

/* ── Note: a disclosure or caveat, never decoration ──────────────────────── */

export function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-sm border border-burgundy/[0.14] bg-burgundy-wash px-[15px] py-[13px] text-[12.5px] leading-relaxed text-[#5b3b3d]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ── Plate: a photograph or a drawing. No chrome, no brackets.
      Brackets belong to navigable media only. ───────────────────────────── */

export function Plate({
  children,
  ratio = "card",
  className,
  scrim = false,
}: {
  children: React.ReactNode;
  ratio?: "cinema" | "viewer" | "plate" | "card" | "thumb" | "auto";
  className?: string;
  scrim?: boolean;
}) {
  const ratios: Record<string, string> = {
    cinema: "aspect-[2.39/1]",
    viewer: "aspect-[16/9]",
    plate: "aspect-[4/5]",
    card: "aspect-[3/2]",
    thumb: "aspect-[16/10]",
    auto: "",
  };
  return (
    <div className={cn("relative overflow-hidden bg-paper-sunken", ratios[ratio], className)}>
      {children}
      {scrim && (
        <div aria-hidden="true" className="av-scrim pointer-events-none absolute inset-0" />
      )}
    </div>
  );
}

/* ── Stage band: the dark surface, used only where media is shown ────────── */

export function StageBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section data-surface="stage" className={cn("bg-stage", className)}>
      {children}
    </section>
  );
}
