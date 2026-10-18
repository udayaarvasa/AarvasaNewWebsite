import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A photograph or render set in a drawn frame: a hairline offset border, a
 * caption chip that says what the picture is, and an optional slow drift.
 *
 * Editorial imagery only. Every picture on the site is of a real project, so
 * the caption is not optional — a render must say it is a render.
 */
export function FramedImage({
  src,
  alt,
  caption,
  sizes,
  className,
  imageClassName,
  drift = true,
  priority,
  offset = "br",
  captionAt = "bottom",
}: {
  src: string;
  alt: string;
  /** What the frame is, e.g. "Developer render · REEF 996". */
  caption: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  /** Slow Ken Burns drift. Off under reduced motion regardless. */
  drift?: boolean;
  priority?: boolean;
  /** Which corner the offset frame line sits behind. */
  offset?: "br" | "bl" | "tr" | "tl";
  /** Move the caption to the top when another frame overlaps the bottom. */
  captionAt?: "top" | "bottom";
}) {
  const shift = {
    br: "translate-x-3 translate-y-3",
    bl: "-translate-x-3 translate-y-3",
    tr: "translate-x-3 -translate-y-3",
    tl: "-translate-x-3 -translate-y-3",
  }[offset];

  return (
    <figure className={cn("relative", className)}>
      <div aria-hidden="true" className={cn("absolute inset-0 border border-gold-ink/45", shift)} />
      <div className="relative h-full w-full overflow-hidden bg-paper-sunken">
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", drift && "av-kenburns", imageClassName)}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[rgba(12,11,10,0.45)] to-transparent" />
        <figcaption className={cn("av-meta absolute left-3 rounded-xs", captionAt === "top" ? "top-3" : "bottom-3", " bg-[rgba(12,11,10,0.66)] px-2 py-1 text-stage-ink backdrop-blur-sm")}>
          {caption}
        </figcaption>
      </div>
    </figure>
  );
}
