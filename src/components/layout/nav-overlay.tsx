"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Lets a page tell the global navigation that its first screen is a dark stage
 * hero, so the bar floats over the media until the page scrolls.
 *
 * Pages opt in by rendering <StageHero> around their hero. Anything that does
 * not opt in gets the solid paper bar, which is the default.
 */

type NavOverlayValue = {
  /** True while a stage hero is mounted on the current page. */
  overlay: boolean;
  setOverlay: (on: boolean) => void;
};

const NavOverlayContext = createContext<NavOverlayValue>({
  overlay: false,
  setOverlay: () => {},
});

export function NavOverlayProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  // Reference counted: a page swap can mount the next hero before the previous
  // one unmounts, and a plain boolean would be left stuck on.
  const setOverlay = useCallback((on: boolean) => {
    setCount((n) => Math.max(0, n + (on ? 1 : -1)));
  }, []);

  const value = useMemo(() => ({ overlay: count > 0, setOverlay }), [count, setOverlay]);

  return <NavOverlayContext.Provider value={value}>{children}</NavOverlayContext.Provider>;
}

export function useNavOverlay() {
  return useContext(NavOverlayContext);
}

/** Wrap a dark, full-bleed hero in this so the navigation floats over it. */
export function StageHero({ children, className }: { children: React.ReactNode; className?: string }) {
  const { setOverlay } = useNavOverlay();

  useEffect(() => {
    setOverlay(true);
    return () => setOverlay(false);
  }, [setOverlay]);

  // Pulled up by the bar's height so the media runs behind it. The bar keeps
  // its place in flow, so nothing shifts when it solidifies on scroll.
  return (
    <section data-surface="stage" className={["-mt-[var(--nav-h)]", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
