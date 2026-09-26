import Image from "next/image";
import Link from "next/link";
import { Wrap } from "./primitives";
import { ContourField, CoordinateMarks, DraftingGrid, ElevationMotif, Grain, MeasureRule } from "./graphics";
import { Parallax, TextReveal } from "./motion";
import { cn } from "@/lib/utils";

/**
 * Full-width visual breaks.
 *
 * These exist to give the page rhythm — to stop long stretches of plain paper
 * — and are used sparingly between major bands. Three kinds:
 *
 *   CinematicBanner   a real image, oversized type, parallax
 *   StatementBanner   typographic, on the dark stage, architectural graphics
 *   TextureBanner     graphics only; carries no photograph and claims none
 *
 * TextureBanner is the one to reach for when no real image of the subject
 * exists. It is deliberately abstract so it can never read as a photograph of
 * a property.
 *
 * A CinematicBanner carrying an architectural RENDER must pass `note`. These
 * banners sit under editorial headlines, which is exactly where an unlabelled
 * render of an unbuilt building reads as a photograph of a finished one.
 */

/* ── Cinematic banner ────────────────────────────────────────────────── */

export function CinematicBanner({
  src,
  alt,
  eyebrow,
  title,
  body,
  href,
  cta,
  height = "tall",
  position = "50% 40%",
  note,
}: {
  src: string;
  alt: string;
  eyebrow?: string;
  title: string;
  body?: string;
  href?: string;
  cta?: string;
  height?: "tall" | "short";
  position?: string;
  /** Provenance, e.g. "Developer render". Required when `src` is not a photograph. */
  note?: string;
}) {
  return (
    <section data-surface="stage" className="relative isolate overflow-hidden bg-stage">
      <Parallax
        distance={40}
        className={cn("absolute inset-0", height === "tall" ? "min-h-[540px]" : "min-h-[380px]")}
      >
        <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" style={{ objectPosition: position }} />
      </Parallax>

      <div aria-hidden="true" className="av-scrim pointer-events-none absolute inset-0 z-[1]" />
      <Grain opacity={0.06} className="z-[1]" />
      <CoordinateMarks tone="stage" className="z-[2] max-md:hidden" />
      {note && (
        <span className="av-meta absolute right-[var(--gutter)] top-[var(--s-5)] z-[3] rounded-xs border border-stage-rule bg-[rgba(12,11,10,0.66)] px-2 py-1 text-stage-ink backdrop-blur-sm">
          {note}
        </span>
      )}

      <div
        className={cn(
          "relative z-[3] flex items-end",
          height === "tall" ? "min-h-[540px] py-[var(--s-14)]" : "min-h-[380px] py-[var(--s-10)]",
        )}
      >
        <Wrap>
          {eyebrow && <span className="av-meta text-gold">{eyebrow}</span>}
          <TextReveal
            text={title}
            as="h2"
            className="av-display mt-3 max-w-[16ch] text-[clamp(30px,4.6vw,60px)] leading-[1.0] text-stage-ink"
          />
          {body && (
            <p className="mt-[var(--s-4)] max-w-[46ch] text-[15px] leading-relaxed text-stage-muted md:text-[16px]">
              {body}
            </p>
          )}
          {href && cta && (
            <Link
              href={href}
              className="av-label mt-[var(--s-6)] inline-flex rounded-xs border border-gold bg-gold px-6 py-[13px] text-stage transition-colors duration-300 hover:bg-transparent hover:text-gold"
            >
              {cta}
            </Link>
          )}
        </Wrap>
      </div>
    </section>
  );
}

/* ── Statement banner ────────────────────────────────────────────────── */

export function StatementBanner({
  eyebrow,
  title,
  body,
  footnote,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  footnote?: string;
}) {
  return (
    <section data-surface="stage" className="relative isolate overflow-hidden bg-stage py-[var(--band)]">
      <ContourField tone="stage" seed={4} className="opacity-60" />
      <DraftingGrid tone="stage" size={64} fade="radial" className="opacity-40" />
      <Grain opacity={0.05} />

      <Wrap className="relative z-[2]">
        {eyebrow && <span className="av-meta text-gold">{eyebrow}</span>}
        <TextReveal
          text={title}
          as="h2"
          className="av-display mt-3 max-w-[20ch] text-[clamp(28px,4.2vw,54px)] leading-[1.04] text-stage-ink"
        />
        {body && (
          <p className="mt-[var(--s-5)] max-w-[58ch] text-[16px] leading-[1.75] text-stage-muted md:text-[17px]">
            {body}
          </p>
        )}
        <div className="mt-[var(--s-8)] max-w-[520px]">
          <MeasureRule tone="stage" />
        </div>
        {footnote && <p className="av-meta mt-[var(--s-4)] text-stage-muted">{footnote}</p>}
      </Wrap>
    </section>
  );
}

/* ── Texture banner ──────────────────────────────────────────────────── */

export function TextureBanner({
  eyebrow,
  title,
  body,
  tone = "paper",
  motif = "elevation",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  tone?: "paper" | "stage";
  motif?: "elevation" | "contour";
}) {
  const stage = tone === "stage";
  return (
    <section
      data-surface={stage ? "stage" : undefined}
      className={cn(
        "relative isolate overflow-hidden py-[var(--band)]",
        stage ? "bg-stage" : "bg-paper-sunken",
      )}
    >
      <DraftingGrid tone={tone} size={40} fade="radial" className={stage ? "opacity-40" : "opacity-30"} />
      {motif === "contour" && <ContourField tone={tone} seed={7} className="opacity-50" />}
      <Grain opacity={0.04} />

      <Wrap className="relative z-[2]">
        <div className="grid grid-cols-1 items-center gap-[var(--s-10)] lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {eyebrow && (
              <span className={cn("av-meta", stage ? "text-gold" : "text-gold-ink")}>{eyebrow}</span>
            )}
            <TextReveal
              text={title}
              as="h2"
              className={cn(
                "av-display mt-3 max-w-[18ch] text-[clamp(26px,3.6vw,44px)] leading-[1.06]",
                stage ? "text-stage-ink" : "text-ink",
              )}
            />
            {body && (
              <p
                className={cn(
                  "mt-[var(--s-4)] max-w-[52ch] text-[15px] leading-[1.75] md:text-[16px]",
                  stage ? "text-stage-muted" : "text-ink-muted",
                )}
              >
                {body}
              </p>
            )}
          </div>

          {motif === "elevation" && (
            <div aria-hidden="true" className="h-[260px] md:h-[320px]">
              <ElevationMotif tone={tone} storeys={16} accentRow={5} />
            </div>
          )}
        </div>
      </Wrap>
    </section>
  );
}
