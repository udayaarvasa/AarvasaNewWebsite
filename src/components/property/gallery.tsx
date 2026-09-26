"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CornerBrackets } from "@/components/av/graphics";
import { cn } from "@/lib/utils";

/**
 * Cinematic gallery strip with a lightbox.
 *
 * Shows only images the project actually has. Captions say what each frame is
 * — a photograph, a render, or the developer's own layout drawing — so a
 * drawing is never mistaken for a photograph of a finished building.
 */

export type GalleryItem = {
  src: string;
  alt: string;
  caption?: string;
  kind?: "photo" | "drawing";
};

export function Gallery({ items, projectName }: { items: GalleryItem[]; projectName: string }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (dir: 1 | -1) => setOpen((i) => (i === null ? null : (i + dir + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, step]);

  if (items.length === 0) return null;

  return (
    <>
      {/* Strip — the first frame leads, the rest follow at half height */}
      <div className="grid gap-[var(--s-3)] md:grid-cols-[1.4fr_1fr]">
        <GalleryFrame item={items[0]} index={0} onOpen={setOpen} tall />
        {items.length > 1 && (
          <div className="grid gap-[var(--s-3)] sm:grid-cols-2 md:grid-cols-1">
            {items.slice(1, 3).map((item, i) => (
              <GalleryFrame key={item.src} item={item} index={i + 1} onOpen={setOpen} />
            ))}
          </div>
        )}
      </div>

      {items.length > 3 && (
        <div className="mt-[var(--s-3)] flex gap-[var(--s-3)] overflow-x-auto pb-2">
          {items.slice(3).map((item, i) => (
            <button
              key={item.src}
              type="button"
              onClick={() => setOpen(i + 3)}
              className="group relative aspect-[16/10] w-[210px] flex-none overflow-hidden bg-paper-sunken"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="210px"
                className={cn(
                  "transition-transform duration-[900ms] ease-[var(--ease-enter)] group-hover:scale-[1.05]",
                  item.kind === "drawing" ? "bg-white object-contain p-1" : "object-cover",
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox — portalled out of the section so an animated ancestor's
          transform cannot become its containing block */}
      {open !== null && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${projectName} gallery`}
          data-surface="stage"
          className="fixed inset-0 z-[80] flex flex-col bg-stage"
        >
          <div className="flex items-center justify-between border-b border-stage-rule px-[var(--gutter)] py-3">
            <span className="av-meta text-stage-muted">
              {String(open + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} ·{" "}
              {projectName}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close gallery"
              className="av-label flex items-center gap-2 text-stage-ink transition-colors hover:text-gold"
            >
              Close <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center p-[var(--s-4)]">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous image"
              className="absolute left-3 z-[2] flex h-11 w-11 items-center justify-center rounded-xs border border-stage-rule text-stage-ink transition-colors hover:border-gold hover:text-gold"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="relative h-full w-full max-w-[1100px]">
              <Image
                src={items[open].src}
                alt={items[open].alt}
                fill
                sizes="100vw"
                className={cn(items[open].kind === "drawing" ? "bg-white object-contain p-3" : "object-contain")}
              />
            </div>

            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next image"
              className="absolute right-3 z-[2] flex h-11 w-11 items-center justify-center rounded-xs border border-stage-rule text-stage-ink transition-colors hover:border-gold hover:text-gold"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {items[open].caption && (
            <p className="border-t border-stage-rule px-[var(--gutter)] py-3 text-[13px] text-stage-muted">
              {items[open].caption}
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function GalleryFrame({
  item,
  index,
  onOpen,
  tall = false,
}: {
  item: GalleryItem;
  index: number;
  onOpen: (i: number) => void;
  tall?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={cn(
        "group relative block w-full overflow-hidden bg-paper-sunken text-left",
        tall ? "aspect-[4/3] md:aspect-auto md:h-full md:min-h-[420px]" : "aspect-[16/10]",
      )}
    >
      <Image
        src={item.src}
        alt={item.alt}
        fill
        sizes={tall ? "(min-width: 768px) 55vw, 100vw" : "(min-width: 768px) 40vw, 50vw"}
        className={cn(
          "transition-transform duration-[1200ms] ease-[var(--ease-enter)] group-hover:scale-[1.04]",
          item.kind === "drawing" ? "bg-white object-contain p-2" : "object-cover",
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-transparent transition-colors duration-500 group-hover:bg-[rgba(12,11,10,0.18)]"
      />
      <CornerBrackets tone="stage" inset={10} size={13} className="opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {item.caption && (
        <span className="av-meta absolute bottom-3 left-3 z-[3] rounded-xs bg-[rgba(12,11,10,0.72)] px-2 py-1 text-stage-ink backdrop-blur-sm">
          {item.caption}
        </span>
      )}
    </button>
  );
}
