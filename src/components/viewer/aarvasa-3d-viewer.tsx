"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Box, Loader2, Maximize2, Minimize2, RotateCcw, TriangleAlert, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  detectWebGL,
  isDocumentVisible,
  isFullscreenSupported,
  prefersReducedMotion,
  subscribeDocumentVisibility,
  subscribeFullscreen,
  subscribeReducedMotion,
} from "@/lib/viewer/capabilities";
import { sourceFromKey, sourceKey } from "@/lib/viewer/source";
import { readViewerTheme } from "@/lib/viewer/theme";
import type { ViewerEngine, ViewerSource, ViewerStatus } from "@/lib/viewer/types";

const MAX_PIXEL_RATIO = 2;
const CANVAS_LABELS = {
  model: "Interactive 3D view. Drag or use the arrow keys to orbit; scroll, pinch, or use plus and minus to zoom.",
  panorama: "Interactive 360° view. Drag or use the arrow keys to look around; scroll, pinch, or use plus and minus to zoom.",
  splat: "Interactive 3D scan. Drag or use the arrow keys to orbit; scroll, pinch, or use plus and minus to zoom.",
} as const;
/** Wording per kind: [noun, short name, load button]. */
const WORDS = {
  model: { noun: "3D view", short: "3D", load: "Load 3D view", role: "3D viewer" },
  panorama: { noun: "360° view", short: "360°", load: "Open 360° view", role: "360° viewer" },
  splat: { noun: "3D scan", short: "3D scan", load: "Open 3D scan", role: "3D scan viewer" },
} as const;
const ZOOM_STEP = 1.2;

export type Aarvasa3DViewerProps = {
  /** Accessible name for the viewer, e.g. the subject being shown. */
  label: string;
  /** What to show. Omitted: a built-in procedural scene. */
  source?: ViewerSource;
  /**
   * When to download the engine. "visible" loads once the viewer is on screen;
   * "interaction" waits for the user to press a button, keeping the engine off
   * the network entirely until asked for.
   */
  loadOn?: "visible" | "interaction";
  /** Slow idle rotation. Ignored when the user prefers reduced motion. */
  autoRotate?: boolean;
  /** Still image shown until the 3D view is ready, and behind the fallback states. */
  poster?: { src: string; width: number; height: number; alt: string };
  className?: string;
  onStatusChange?: (status: ViewerStatus) => void;
  /**
   * Extra UI drawn over the canvas once something has been shown (e.g. 360°
   * hotspots and room controls). It stays mounted while a new source loads or
   * fails, so the visitor can always pick another room. Receives the engine so
   * it can project directions, and the status so it can hide stale hotspots.
   */
  overlay?: (engine: ViewerEngine, status: ViewerStatus) => React.ReactNode;
  /** Replaces the load button's text (default "Load 3D view", "Open 360° view" or "Open 3D scan"). */
  loadLabel?: string;
};

type Phase =
  | { status: "idle" }
  | { status: "unsupported"; webgl1: boolean }
  | { status: "starting" }
  | { status: "running" }
  | { status: "context-lost" }
  | { status: "error"; message: string };

const describe = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");
const subscribeNever = () => () => {};

/**
 * Public 3D viewer. Renders a server-safe shell; the PlayCanvas engine is only
 * imported in the browser, from an effect, once the viewer should load.
 */
export function Aarvasa3DViewer({
  label,
  source,
  loadOn = "visible",
  autoRotate = false,
  poster,
  className,
  onStatusChange,
  overlay,
  loadLabel,
}: Aarvasa3DViewerProps) {
  const viewerId = useId();
  const containerRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>({ status: "idle" });
  const [engine, setEngine] = useState<ViewerEngine | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<{ key: string; message: string } | null>(null);
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [inView, setInView] = useState(false);

  const pageVisible = useSyncExternalStore(subscribeDocumentVisibility, isDocumentVisible, () => true);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const canFullscreen = useSyncExternalStore(subscribeNever, isFullscreenSupported, () => false);
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement?.getAttribute("data-viewer-id") === viewerId,
    () => false,
  );

  const key = sourceKey(source);
  const kind = source?.kind ?? "model";
  const words = WORDS[kind];
  const noun = words.noun;

  // Capability check happens here, at the moment loading is requested, so an
  // unsupported browser never downloads the engine.
  const requestLoad = useCallback(() => {
    setPhase((current) => {
      if (current.status !== "idle") return current;
      const support = detectWebGL();
      return support.webgl2 ? { status: "starting" } : { status: "unsupported", webgl1: support.webgl1 };
    });
  }, []);

  // On-screen tracking: drives lazy loading and pauses rendering off-screen.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting && loadOn === "visible") requestLoad();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadOn, requestLoad]);

  // Engine lifetime. Each run owns exactly one engine and destroys it on
  // cleanup, which covers unmount, client-side navigation, retries, and React
  // Strict Mode's mount → unmount → mount in development.
  const engineWanted = phase.status === "starting" || phase.status === "running" || phase.status === "context-lost";
  useEffect(() => {
    const host = hostRef.current;
    if (!engineWanted || !host) return;

    let cancelled = false;
    let created: ViewerEngine | null = null;

    import("@/lib/viewer/playcanvas/create-engine")
      .then(({ createViewerEngine }) => {
        // Strict Mode's first mount is cleaned up before the import resolves,
        // so only the surviving mount ever creates a GPU context.
        if (cancelled) return;
        created = createViewerEngine(host, {
          maxPixelRatio: MAX_PIXEL_RATIO,
          canvasLabel: CANVAS_LABELS[kind],
          theme: readViewerTheme(host),
          onContextLost: () => setPhase({ status: "context-lost" }),
          onContextRestored: () => setPhase({ status: "running" }),
        });
        setEngine(created);
        setPhase({ status: "running" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setPhase({ status: "error", message: describe(error) });
      });

    return () => {
      cancelled = true;
      created?.destroy();
      setEngine(null);
      setLoadedKey(null);
    };
    // The canvas label follows the kind of the first source; a viewer does not switch kinds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineWanted, attempt]);

  // Source loading. Keyed by a string so a new-but-equal `source` object from
  // the parent does not reload the asset.
  useEffect(() => {
    if (!engine) return;
    let stale = false;
    engine
      .setSource(sourceFromKey(key))
      .then(() => {
        if (stale) return;
        setLoadedKey(key);
        setSourceError(null);
      })
      .catch((error: unknown) => {
        if (!stale) setSourceError({ key, message: describe(error) });
      });
    return () => {
      stale = true;
    };
  }, [engine, key, sourceAttempt]);

  // Follow the site theme: theme-provider flips `data-theme`/`.dark` on <html>.
  useEffect(() => {
    const host = hostRef.current;
    if (!engine || !host) return;
    const apply = () => engine.setTheme(readViewerTheme(host));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, [engine]);

  const active = inView && pageVisible;
  useEffect(() => {
    engine?.setActive(active);
  }, [engine, active]);

  useEffect(() => {
    engine?.setMotion({ autoRotate, reducedMotion });
  }, [engine, autoRotate, reducedMotion]);

  const status: ViewerStatus = (() => {
    switch (phase.status) {
      case "idle":
      case "unsupported":
      case "error":
      case "context-lost":
        return phase.status;
      case "starting":
        return "loading";
      case "running":
        if (sourceError?.key === key) return "error";
        return loadedKey === key ? "ready" : "loading";
    }
  })();

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const retry = () => {
    if (phase.status === "running") {
      setSourceError(null);
      setSourceAttempt((n) => n + 1);
    } else {
      setPhase({ status: "starting" });
      setAttempt((n) => n + 1);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen().catch(() => {});
    }
  };

  // Something is on screen: the previous source stays visible while the next one loads.
  const hasContent = phase.status === "running" && engine !== null && loadedKey !== null;
  const switching = hasContent && status === "loading";
  const showControls = hasContent && (status === "ready" || status === "loading");

  const errorMessage =
    phase.status === "error" ? phase.message : sourceError?.key === key ? sourceError.message : null;

  return (
    <section
      ref={containerRef}
      data-viewer-id={viewerId}
      data-viewer-status={status}
      data-viewer-kind={kind}
      aria-label={label}
      aria-roledescription={words.role}
      aria-busy={status === "loading"}
      className={cn(
        "relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-background text-foreground sm:aspect-video",
        "has-[canvas:focus-visible]:ring-2 has-[canvas:focus-visible]:ring-ring",
        "[&:fullscreen]:aspect-auto [&:fullscreen]:rounded-none [&:fullscreen]:border-0",
        className,
      )}
    >
      {/* The engine appends and removes its own canvas here. */}
      <div ref={hostRef} className="absolute inset-0" />

      {poster && status !== "ready" && (
        // Already optimised by the media pipeline, so it bypasses the image optimiser.
        <Image src={poster.src} alt={poster.alt} fill unoptimized sizes="100vw" className="object-cover" />
      )}

      {status === "idle" && (
        <Panel overPoster={Boolean(poster)} icon={<Box className="h-8 w-8 text-accent" aria-hidden />} title={label}>
          {loadOn === "interaction" ? (
            <Button onClick={requestLoad} className="mt-2">
              {loadLabel ?? words.load}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">The {noun} loads when it scrolls into view.</p>
          )}
        </Panel>
      )}

      {switching && (
        <p className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--glass-strong)] px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-md">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent motion-reduce:animate-none" aria-hidden />
          Loading…
        </p>
      )}

      {((status === "loading" && !switching) || status === "context-lost") && (
        <Panel
          translucent
          icon={<Loader2 className="h-7 w-7 animate-spin text-accent motion-reduce:animate-none" aria-hidden />}
          title={status === "loading" ? `Loading ${noun}…` : "Graphics interrupted — restoring…"}
        />
      )}

      {status === "unsupported" && phase.status === "unsupported" && (
        <Panel overPoster={Boolean(poster)} icon={<TriangleAlert className="h-7 w-7 text-accent" aria-hidden />} title={`${words.short} view unavailable`}>
          <p className="max-w-sm text-sm text-muted-foreground">
            {phase.webgl1
              ? `This browser only supports WebGL 1, and the ${noun} needs WebGL 2.`
              : "WebGL is unavailable or disabled in this browser."}
          </p>
        </Panel>
      )}

      {status === "error" && (
        <Panel overPoster={Boolean(poster)} icon={<TriangleAlert className="h-7 w-7 text-accent" aria-hidden />} title={`Couldn't load the ${noun}`}>
          {errorMessage && <p className="max-w-sm text-xs text-muted-foreground">{errorMessage}</p>}
          <Button variant="outline" size="sm" onClick={retry} className="mt-2 text-foreground">
            Try again
          </Button>
        </Panel>
      )}

      {showControls && (
        <>
          <div className="absolute right-3 top-3 flex gap-2">
            <Button
              variant="glass"
              size="icon"
              onClick={() => engine?.zoomBy(1 / ZOOM_STEP)}
              aria-label="Zoom in"
              title="Zoom in"
              className="text-foreground"
            >
              <ZoomIn className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => engine?.zoomBy(ZOOM_STEP)}
              aria-label="Zoom out"
              title="Zoom out"
              className="text-foreground"
            >
              <ZoomOut className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => engine?.resetView()}
              aria-label="Reset view"
              title="Reset view"
              className="text-foreground"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </Button>
            {canFullscreen && (
              <Button
                variant="glass"
                size="icon"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                title={isFullscreen ? "Exit full screen" : "Full screen"}
                className="text-foreground"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" aria-hidden />
                ) : (
                  <Maximize2 className="h-4 w-4" aria-hidden />
                )}
              </Button>
            )}
          </div>
          <p className={cn("pointer-events-none absolute bottom-3 left-3 rounded-full bg-[var(--glass-strong)] px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-md", overlay && "max-sm:hidden")}>
            <span className="pointer-coarse:hidden">Drag to {kind === "panorama" ? "look around" : "orbit"} · Scroll to zoom</span>
            <span className="hidden pointer-coarse:inline">Drag to {kind === "panorama" ? "look around" : "orbit"} · Pinch to zoom</span>
          </p>
        </>
      )}

      {/* Last, so it sits above the loading and error panels. */}
      {hasContent && engine && overlay?.(engine, status)}

      <p className="sr-only" aria-live="polite">
        {status === "loading" ? `Loading ${noun}` : status === "ready" ? `${words.short} view ready` : status === "error" ? `Couldn't load the ${noun}` : ""}
      </p>
    </section>
  );
}

function Panel({
  icon,
  title,
  translucent = false,
  overPoster = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  translucent?: boolean;
  /** A light, unblurred scrim so the poster stays recognisable behind the text. */
  overPoster?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center",
        overPoster ? "bg-background/45" : translucent ? "bg-background/60 backdrop-blur-sm" : "bg-background",
      )}
    >
      {icon}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}
