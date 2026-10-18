import Image from "next/image";
import type { ReactNode } from "react";
import { StageHero } from "@/components/layout/nav-overlay";
import { cn } from "@/lib/utils";
import { FadeUp, LuxHeading } from "./motion";
import { Container } from "./primitives";

/**
 * The opening of every inner page: a frame of real architecture (or warm
 * light where there is none), the eyebrow, the title rising word by word,
 * and whatever the page needs beneath it.
 */
export function PageHero({
  eyebrow,
  title,
  body,
  image,
  caption,
  children,
  size = "default",
  align = "left",
}: {
  eyebrow: string;
  /** Asterisks mark the gold italic accent. */
  title: string;
  body?: ReactNode;
  image?: string;
  /** What the frame is — required in spirit whenever `image` is a render. */
  caption?: string;
  children?: ReactNode;
  size?: "default" | "tall" | "compact";
  align?: "left" | "center";
}) {
  const centered = align === "center";
  const height = size === "tall" ? "min-h-[86svh]" : size === "compact" ? "min-h-[46svh]" : "min-h-[68svh]";

  return (
    <StageHero className="relative isolate overflow-hidden">
      <div className={cn("relative", height)}>
        {image ? (
          <div className="absolute inset-0">
            <Image src={image} alt="" fill priority sizes="100vw" className="av-kenburns object-cover" />
          </div>
        ) : null}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0",
            image
              ? "bg-[linear-gradient(180deg,rgba(7,5,5,0.55)_0%,rgba(7,5,5,0.05)_35%,rgba(7,5,5,0.5)_72%,var(--paper)_100%)]"
              : "bg-[radial-gradient(90%_90%_at_75%_0%,#4f060c_0%,#0c0909_65%)]",
          )}
        />
        {image && <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,5,5,0.82)_0%,rgba(7,5,5,0.45)_45%,rgba(7,5,5,0)_75%)]" />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={image ? "lux-aurora opacity-25" : "lux-aurora opacity-60"} />
        </div>
        {caption && (
          <span className="av-meta absolute right-[var(--gutter)] top-[calc(var(--nav-h)+16px)] z-[3] hidden rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] text-stage-ink backdrop-blur-md md:block">
            {caption}
          </span>
        )}

        <Container
          className={cn(
            "relative z-[3] flex flex-col justify-end pb-[clamp(48px,7vw,96px)] pt-[calc(var(--nav-h)+56px)]",
            height,
            centered && "items-center text-center",
          )}
        >
          <FadeUp immediate delay={0.1} y={12}>
            <span className="lux-eyebrow">{eyebrow}</span>
          </FadeUp>
          <LuxHeading
            as="h1"
            immediate
            delay={0.2}
            text={title}
            className={cn(
              "av-display mt-5 text-[clamp(46px,7.4vw,112px)] font-light leading-[0.94] text-stage-ink",
              centered ? "max-w-[16ch]" : "max-w-[15ch]",
            )}
          />
          {body && (
            <FadeUp immediate delay={0.55} className={cn("mt-6 max-w-[56ch] text-[clamp(15px,1.25vw,18px)] leading-relaxed text-stage-muted", centered && "mx-auto")}>
              {body}
            </FadeUp>
          )}
          {children && (
            <FadeUp immediate delay={0.75} className="mt-8 w-full">
              {children}
            </FadeUp>
          )}
        </Container>
      </div>
    </StageHero>
  );
}
