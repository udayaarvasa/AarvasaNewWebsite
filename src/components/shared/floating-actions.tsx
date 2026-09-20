"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Back to top, and nothing else.
 *
 * The advisor used to live here as a floating gold orb on every page. It now
 * reaches people through the navigation, its own route and the rail on a
 * property — the design language treats AI as a supporting layer, never a
 * badge that follows the reader around.
 */
export function FloatingActions() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-xs border border-rule-firm bg-paper-raised text-ink transition-opacity duration-300 hover:bg-paper-sunken",
        show ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ChevronUp className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
