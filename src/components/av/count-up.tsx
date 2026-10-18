"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A figure that counts up when it scrolls into view.
 *
 * The real value is rendered on the server, so without script — or with
 * reduced motion — the number is simply there. Only the figures passed in are
 * shown; this component never decides what a number is.
 */
export function CountUp({ value, duration = 1400 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let settle = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // ease-out-cubic: quick start, settles onto the figure
          setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        setShown(0);
        frame = requestAnimationFrame(tick);
        // A throttled or backgrounded tab can starve animation frames; the
        // figure must still land on its real value.
        settle = window.setTimeout(() => setShown(value), duration + 250);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [value, duration]);

  return (
    <span ref={ref} aria-label={String(value)}>
      <span aria-hidden="true">{shown.toLocaleString("en-IN")}</span>
    </span>
  );
}
