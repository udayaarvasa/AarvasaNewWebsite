"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { EASE } from "./motion";

export type ShowcaseFrame = { src: string; thumb: string; alt: string; caption: string };

/**
 * A large frame with a row of thumbnails beneath it. Choosing a thumbnail
 * crossfades the frame; each frame names what it is.
 */
export function Showcase({ frames }: { frames: ShowcaseFrame[] }) {
  const [active, setActive] = useState(0);
  const frame = frames[active];
  if (!frame) return null;

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-stage sm:aspect-[5/5]">
        <AnimatePresence initial={false}>
          <motion.div
            key={frame.src}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: EASE }}
          >
            <Image src={frame.src} alt={frame.alt} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(7,5,5,0.7))]" />
        <span className="av-meta absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1.5 text-[10px] text-stage-ink backdrop-blur-md">
          {frame.caption}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3" role="tablist" aria-label="Project images">
        {frames.slice(0, 4).map((f, i) => (
          <button
            key={f.src}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Show ${f.alt}`}
            onClick={() => setActive(i)}
            className={`relative aspect-square overflow-hidden rounded-2xl transition-all duration-500 ${
              i === active ? "ring-2 ring-gold ring-offset-2 ring-offset-[var(--paper-raised)]" : "opacity-55 hover:opacity-100"
            }`}
          >
            <Image src={f.thumb} alt="" fill sizes="120px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
