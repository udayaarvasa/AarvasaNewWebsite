"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Eye, EyeOff, Info, List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Aarvasa3DViewer } from "@/components/viewer/aarvasa-3d-viewer";
import { trackViewerEvent } from "@/lib/viewer/analytics";
import { navigate, sceneById, sceneSource, tourFloors, type PanoramaTour, type TourHotspot, type TourScene } from "@/lib/viewer/tour";
import type { ViewerEngine, ViewerStatus } from "@/lib/viewer/types";

export type PanoramaTourViewerProps = {
  tour: PanoramaTour;
  /** Project slug, for analytics only. */
  analyticsId?: string;
  className?: string;
  /** Shows a close button that calls this (the parent unmounts the tour). */
  onExit?: () => void;
  onStatusChange?: (status: ViewerStatus) => void;
};

/**
 * A 360° room-to-room tour on top of Aarvasa3DViewer. One engine serves the
 * whole tour: changing rooms only changes the viewer's source, so the canvas
 * and GPU context are kept, only the current room's panorama is resident, and a
 * room that is superseded while loading is cancelled by the engine.
 */
export function PanoramaTourViewer({ tour, analyticsId, className, onExit, onStatusChange }: PanoramaTourViewerProps) {
  const [currentId, setCurrentId] = useState(tour.startSceneId);
  const scene = sceneById(tour, currentId) ?? tour.scenes[0];
  const source = useMemo(() => sceneSource(scene), [scene]);
  const [notice, setNotice] = useState<string | null>(null);
  // The scene being requested, for status analytics. Set in the event handler, not in
  // an effect: the viewer reports status from its own effects, which run first.
  const sceneIdRef = useRef(scene.id);

  const goTo = useCallback(
    (targetId: string | undefined, via: "hotspot" | "selector") => {
      const result = navigate(tour, scene.id, targetId);
      if (!result.ok) {
        if (result.reason === "missing-target") {
          setNotice("That room isn't available.");
          trackViewerEvent("viewer_error", { project: analyticsId, mode: "panorama", sceneId: scene.id, errorKind: "missing-target" });
        }
        return;
      }
      setNotice(null);
      sceneIdRef.current = result.scene.id;
      setCurrentId(result.scene.id);
      trackViewerEvent("panorama_navigation", { project: analyticsId, fromSceneId: scene.id, toSceneId: result.scene.id, via });
    },
    [tour, scene.id, analyticsId],
  );

  // Status reporting and analytics; refs keep the callback stable for the viewer's effect.
  const onStatusRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusRef.current = onStatusChange;
  });
  const handleStatus = useCallback(
    (status: ViewerStatus) => {
      onStatusRef.current?.(status);
      if (status === "error") trackViewerEvent("viewer_error", { project: analyticsId, mode: "panorama", sceneId: sceneIdRef.current, errorKind: "load" });
    },
    [analyticsId],
  );

  return (
    <Aarvasa3DViewer
      className={className}
      label={tour.label}
      source={source}
      loadOn="interaction"
      loadLabel="Open 360° tour"
      onStatusChange={handleStatus}
      overlay={(engine, status) => (
        <TourOverlay
          engine={engine}
          status={status}
          tour={tour}
          scene={scene}
          notice={notice}
          onNavigate={goTo}
          onExit={onExit}
          analyticsId={analyticsId}
        />
      )}
    />
  );
}

type OverlayProps = {
  engine: ViewerEngine;
  status: ViewerStatus;
  tour: PanoramaTour;
  scene: TourScene;
  notice: string | null;
  onNavigate: (targetId: string | undefined, via: "hotspot" | "selector") => void;
  onExit?: () => void;
  analyticsId?: string;
};

function TourOverlay({ engine, status, tour, scene, notice, onNavigate, onExit, analyticsId }: OverlayProps) {
  const panelId = useId();
  const [showHotspots, setShowHotspots] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [info, setInfo] = useState<{ sceneId: string; hotspot: TourHotspot } | null>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const floors = useMemo(() => tourFloors(tour), [tour]);
  const ready = status === "ready";
  const openInfo = info?.sceneId === scene.id ? info.hotspot : null;

  // Each room that finishes loading: record it, and after a room change move
  // focus off the hotspot that was just removed.
  const previousScene = useRef(scene.id);
  useEffect(() => {
    if (!ready) return;
    trackViewerEvent("panorama_opened", { project: analyticsId, sceneId: scene.id, placeholder: tour.placeholder });
    if (previousScene.current !== scene.id) titleRef.current?.focus({ preventScroll: true });
    previousScene.current = scene.id;
  }, [scene.id, ready, analyticsId, tour.placeholder]);

  const activate = (hotspot: TourHotspot) => {
    trackViewerEvent("hotspot_clicked", { project: analyticsId, sceneId: scene.id, hotspotId: hotspot.id, hotspotType: hotspot.type });
    if (hotspot.type === "navigation") {
      setInfo(null);
      onNavigate(hotspot.targetSceneId, "hotspot");
    } else {
      setInfo({ sceneId: scene.id, hotspot });
    }
  };

  const roomsByFloor = floors.length > 0 ? floors.map((floor) => ({ floor, scenes: tour.scenes.filter((s) => (s.floor ?? "Other") === floor) })) : [{ floor: null, scenes: tour.scenes }];

  return (
    <>
      {showHotspots && ready && <HotspotLayer key={scene.id} engine={engine} hotspots={scene.hotspots} onActivate={activate} />}

      {/* Room name and tour controls: along the bottom on phones (the viewer toolbar
          fills the top), top-left from sm up. The rooms panel opens towards the middle. */}
      <div className="absolute inset-x-3 bottom-3 z-10 flex max-h-[calc(100%-4.5rem)] flex-col-reverse gap-2 sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-3 sm:max-h-[calc(100%-1.5rem)] sm:w-72 sm:flex-col">
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-[var(--glass-strong)] p-1 pl-3 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            <p ref={titleRef} tabIndex={-1} className="truncate text-sm font-semibold text-foreground outline-none">
              {scene.title}
            </p>
            {scene.floor && <p className="truncate text-[11px] text-muted-foreground">{scene.floor}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            aria-label="Rooms and points of interest"
            title="Rooms"
            className="h-10 w-10 shrink-0 text-foreground"
          >
            <List className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHotspots((v) => !v)}
            aria-pressed={showHotspots}
            aria-label="Show hotspots"
            title={showHotspots ? "Hide hotspots" : "Show hotspots"}
            className="h-10 w-10 shrink-0 text-foreground"
          >
            {showHotspots ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
          </Button>
          {onExit && (
            <Button variant="ghost" size="icon" onClick={onExit} aria-label="Close 360° tour" title="Close tour" className="h-10 w-10 shrink-0 text-foreground">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>

        {panelOpen && (
          <div id={panelId} className="min-h-0 overflow-y-auto rounded-xl bg-[var(--glass-strong)] p-3 text-sm backdrop-blur-md">
            <nav aria-label="Rooms">
              {roomsByFloor.map(({ floor, scenes }) => (
                <div key={floor ?? "all"} className="mb-2 last:mb-0">
                  {floor && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{floor}</p>}
                  <ul className="space-y-1">
                    {scenes.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(s.id, "selector")}
                          aria-current={s.id === scene.id ? "location" : undefined}
                          className={cn(
                            "flex min-h-10 w-full items-center rounded-lg px-2 text-left text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            s.id === scene.id && "bg-muted font-semibold",
                          )}
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            {scene.hotspots.length > 0 && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In this room</p>
                <ul className="space-y-1">
                  {scene.hotspots.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => activate(h)}
                        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {h.type === "navigation" ? <ArrowUpRight className="h-4 w-4 shrink-0 text-accent" aria-hidden /> : <Info className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
                        {h.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {openInfo && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-info`}
          className="absolute inset-x-3 top-16 z-20 mx-auto max-w-md rounded-xl sm:bottom-12 sm:top-auto bg-[var(--glass-strong)] p-4 text-sm backdrop-blur-md"
        >
          <div className="flex items-start gap-2">
            <p id={`${panelId}-info`} className="flex-1 font-semibold text-foreground">
              {openInfo.label}
            </p>
            <Button variant="ghost" size="icon" autoFocus onClick={() => setInfo(null)} aria-label="Close" className="-mr-2 -mt-2 h-10 w-10 text-foreground">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <p className="mt-1 text-muted-foreground">{openInfo.description}</p>
        </div>
      )}

      {notice && (
        <p role="alert" className="absolute inset-x-3 top-16 z-20 sm:bottom-12 sm:top-auto mx-auto w-fit rounded-full bg-[var(--glass-strong)] px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-md">
          {notice}
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {ready ? `Now viewing ${scene.title}${scene.floor ? `, ${scene.floor}` : ""}. ${scene.alt}` : ""}
      </p>
    </>
  );
}

/**
 * Hotspot buttons positioned over the canvas. Positions are written straight
 * to the DOM from the engine's per-frame view callback, so looking around never
 * re-renders React. Hotspots behind the camera are hidden (and so leave the tab
 * order); the rooms panel lists every hotspot for keyboard and screen-reader use.
 */
function HotspotLayer({
  engine,
  hotspots,
  onActivate,
}: {
  engine: ViewerEngine;
  hotspots: TourHotspot[];
  onActivate: (hotspot: TourHotspot) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const place = () => {
      const { width, height } = layer.getBoundingClientRect();
      for (const h of hotspots) {
        const button = buttons.current.get(h.id);
        if (!button) continue;
        const p = engine.projectDirection(h.yawDeg, h.pitchDeg);
        const visible = p !== null && p.x >= -24 && p.y >= -24 && p.x <= width + 24 && p.y <= height + 24;
        button.style.visibility = visible ? "visible" : "hidden";
        if (p) button.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      }
    };
    place();
    return engine.onViewChange(place);
  }, [engine, hotspots]);

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {hotspots.map((h) => (
        <button
          key={h.id}
          ref={(el) => {
            if (el) buttons.current.set(h.id, el);
            else buttons.current.delete(h.id);
          }}
          type="button"
          onClick={() => onActivate(h)}
          aria-label={h.label}
          data-hotspot-id={h.id}
          style={{ visibility: "hidden" }}
          className="group pointer-events-auto absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/90 bg-black/45 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {h.type === "navigation" ? <ArrowUpRight className="h-5 w-5" aria-hidden /> : <Info className="h-5 w-5" aria-hidden />}
          <span
            aria-hidden
            className="pointer-events-none absolute top-full mt-1.5 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          >
            {h.label}
          </span>
        </button>
      ))}
    </div>
  );
}
