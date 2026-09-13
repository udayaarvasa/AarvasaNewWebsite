import type { RGB, ViewerTheme } from "./types";

// Used only if a variable is missing. They mirror the light-theme tokens in
// globals.css; the live values are always read from the page.
const FALLBACK: ViewerTheme = {
  background: [0.949, 0.945, 0.929], // --background #F2F1ED
  foreground: [0.314, 0.031, 0.055], // --foreground #50080E
  accent: [0.831, 0.686, 0.216], // --accent #D4AF37
};

function parseColor(value: string): RGB | null {
  const v = value.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    const channel = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return [channel(0), channel(2), channel(4)];
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];

  return null;
}

/**
 * Reads the site's existing theme variables as resolved for `element`, so the
 * viewer follows light/dark mode without a theme system of its own.
 */
export function readViewerTheme(element: Element): ViewerTheme {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: RGB) => parseColor(style.getPropertyValue(name)) ?? fallback;
  return {
    background: read("--background", FALLBACK.background),
    foreground: read("--foreground", FALLBACK.foreground),
    accent: read("--accent", FALLBACK.accent),
  };
}

/** Linear blend of two colours; t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
