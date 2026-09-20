"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Box, Maximize2, Minus, Plus, RotateCw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackViewerEvent } from "@/lib/viewer/analytics";
import { detectWebGL } from "@/lib/viewer/capabilities";
import type { ViewerEngine, ViewerStatus, ViewerXrEvent } from "@/lib/viewer/types";
import { detectXrSupport, xrUnavailableMessage, type XrMode, type XrSupport } from "@/lib/viewer/xr-capabilities";
import { XR_SCALE_LIMITS, type XrExperience } from "@/lib/viewer/xr-contract";
import { arInstruction, canRequestXr, canTransform, xrAnnouncement, xrErrorMessage, XR_INITIAL_STATE, xrReduce } from "@/lib/viewer/xr-session";

const MODE_LABEL: Record<XrMode, string> = { ar: "View in AR", vr: "VR Walkthrough" };
const ROTATE_STEP = 15;

/**
 * Detects what this device can do, once per page. Returns null until the
 * answer is known, so no AR/VR button is ever shown before then.
 */
export function useXrSupport(enabled: boolean): XrSupport | null {
  const [support, setSupport] = useState<XrSupport | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void detectXrSupport({ webgl2: detectWebGL().webgl2 }).then((result) => {
      if (!cancelled) setSupport(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return support;
}

export type XrControlsProps = {
  engine: ViewerEngine;
  status: ViewerStatus;
  experience: XrExperience;
  support: XrSupport | null;
  /** Project slug, for analytics only. */
  analyticsId?: string;
};

/**
 * AR Room Preview and VR Walkthrough for the model currently in the viewer.
 *
 * A mode's button appears only when the project offers it *and* the device
 * reports it; otherwise the visitor sees a short "not available" line and keeps
 * the interactive 3D model. A session only ever starts from a button press.
 */
export function XrControls({ engine, status, experience, support, analyticsId }: XrControlsProps) {
  const [state, dispatch] = useReducer(xrReduce, XR_INITIAL_STATE);
  const [announcement, setAnnouncement] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const previous = useRef(state);
  const ready = status === "ready";

  useEffect(() => {
    const message = xrAnnouncement(previous.current, state);
    previous.current = state;
    if (message) setAnnouncement(message);
  }, [state]);

  // The engine holds the placement; the state machine holds the numbers.
  useEffect(() => {
    if (canTransform(state)) engine.xrSetTransform(state.rotationDeg, state.scale);
  }, [engine, state]);

  // The mode being started, so each event carries the right name.
  const startingMode = useRef<XrMode>("ar");

  const onEvent = useCallback(
    (event: ViewerXrEvent) => {
      const mode = startingMode.current;
      switch (event.type) {
        case "started":
          dispatch({ type: "started" });
          trackViewerEvent(mode === "ar" ? "ar_started" : "vr_started", { project: analyticsId, xrMode: mode });
          break;
        case "surface":
          dispatch({ type: "surface", found: event.found });
          break;
        case "failed":
          dispatch({ type: "failed", kind: event.kind });
          trackViewerEvent(mode === "ar" ? "ar_error" : "vr_error", { project: analyticsId, xrMode: mode, errorKind: event.kind });
          break;
        case "ended":
          dispatch({ type: "ended" });
          trackViewerEvent("xr_exit", { project: analyticsId, xrMode: mode, exitReason: "session-ended" });
          break;
      }
    },
    [analyticsId],
  );

  const start = (mode: XrMode) => {
    if (!support || !canRequestXr(state, mode, support)) return;
    startingMode.current = mode;
    dispatch({ type: "request", mode });
    trackViewerEvent(mode === "ar" ? "ar_opened" : "vr_opened", { project: analyticsId, xrMode: mode });
    void engine.startXr({ mode, scale: experience.scale, domOverlayRoot: overlayRef.current, onEvent });
  };

  const exit = () => {
    dispatch({ type: "request-exit" });
    trackViewerEvent("xr_exit", { project: analyticsId, xrMode: state.mode ?? startingMode.current, exitReason: "user" });
    engine.endXr();
  };

  const offered = useMemo(() => experience.modes.filter((mode) => support?.[mode]), [experience.modes, support]);

  // Build the XR runtime once a mode is actually on offer, so the first tap starts
  // a session instead of waiting for the device availability check.
  useEffect(() => {
    if (ready && offered.length > 0) void engine.prepareXr();
  }, [engine, ready, offered.length]);

  const refused = useMemo(() => experience.modes.filter((mode) => support && !support[mode]), [experience.modes, support]);
  const inSession = state.phase === "active" || state.phase === "requesting" || state.phase === "ending";

  return (
    <>
      {/* Entry points, over the 3D view, once the model is on screen. */}
      {ready && !inSession && (
        <div className="absolute bottom-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
          {state.phase === "error" && state.error && (
            <p role="status" className="max-w-xs rounded-xl bg-[var(--glass-strong)] px-3 py-2 text-right text-[11px] font-medium text-foreground backdrop-blur-md">
              {xrErrorMessage(state.mode, state.error)}
            </p>
          )}
          {refused.length > 0 && offered.length === 0 && support && (
            <p role="note" className="max-w-xs rounded-xl bg-[var(--glass-strong)] px-3 py-2 text-right text-[11px] font-medium text-muted-foreground backdrop-blur-md">
              {xrUnavailableMessage(refused[0], support)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {offered.map((mode) => (
              <Button key={mode} variant="glass" onClick={() => start(mode)} className="min-h-10 text-foreground" title={mode === "ar" ? experience.arHelp : experience.vrHelp}>
                {mode === "ar" ? <Smartphone className="mr-2 h-4 w-4" aria-hidden /> : <Box className="mr-2 h-4 w-4" aria-hidden />}
                {MODE_LABEL[mode]}
              </Button>
            ))}
          </div>
          {offered.length > 0 && (
            <p className="max-w-xs rounded-xl bg-[var(--glass-strong)] px-3 py-1.5 text-right text-[11px] text-muted-foreground backdrop-blur-md">
              {offered.includes("ar") ? experience.arHelp : experience.vrHelp}
              {experience.placeholder && " This is a placeholder model."}
            </p>
          )}
        </div>
      )}

      {/*
        The AR overlay: shown over the camera feed where the browser supports DOM
        overlay, and over the page while a session is starting. It is always in the
        DOM so the session can be started with it as its root.
      */}
      <div
        ref={overlayRef}
        data-xr-overlay={state.phase}
        className={cn(
          "pointer-events-none fixed inset-0 z-[60] flex flex-col justify-between p-4",
          inSession ? "pointer-events-auto" : "hidden",
        )}
      >
        {inSession && (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="max-w-[70%] rounded-xl bg-black/70 px-3 py-2 text-sm font-medium text-white shadow-lg">
                {state.phase === "requesting" ? "Starting…" : arInstruction(state) || (state.mode === "vr" ? "Use your controller: point at a marker and select to move. Squeeze to leave." : "")}
              </p>
              <Button variant="glass" size="icon" onClick={exit} aria-label={state.mode === "vr" ? "Exit VR walkthrough" : "Exit AR preview"} className="h-11 w-11 bg-black/70 text-white">
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>

            {state.mode === "ar" && state.phase === "active" && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {state.placement !== "placed" ? (
                  <Button
                    onClick={() => {
                      dispatch({ type: "place" });
                      engine.xrPlace();
                      trackViewerEvent("ar_placement", { project: analyticsId });
                    }}
                    disabled={state.placement !== "ready"}
                    className="min-h-11 px-6"
                  >
                    Place
                  </Button>
                ) : (
                  <>
                    <Button variant="glass" size="icon" onClick={() => dispatch({ type: "rotate", deltaDeg: -ROTATE_STEP })} aria-label="Turn left" className="h-11 w-11 bg-black/70 text-white">
                      <RotateCw className="h-5 w-5 -scale-x-100" aria-hidden />
                    </Button>
                    <Button variant="glass" size="icon" onClick={() => dispatch({ type: "rotate", deltaDeg: ROTATE_STEP })} aria-label="Turn right" className="h-11 w-11 bg-black/70 text-white">
                      <RotateCw className="h-5 w-5" aria-hidden />
                    </Button>
                    <Button variant="glass" size="icon" onClick={() => dispatch({ type: "scale-by", factor: 1 / XR_SCALE_LIMITS.step })} aria-label="Make smaller" className="h-11 w-11 bg-black/70 text-white">
                      <Minus className="h-5 w-5" aria-hidden />
                    </Button>
                    <Button variant="glass" size="icon" onClick={() => dispatch({ type: "scale-by", factor: XR_SCALE_LIMITS.step })} aria-label="Make larger" className="h-11 w-11 bg-black/70 text-white">
                      <Plus className="h-5 w-5" aria-hidden />
                    </Button>
                    <Button
                      variant="glass"
                      onClick={() => {
                        dispatch({ type: "reset-placement" });
                        engine.xrResetPlacement();
                        trackViewerEvent("ar_placement_reset", { project: analyticsId });
                      }}
                      className="min-h-11 bg-black/70 text-white"
                    >
                      <Maximize2 className="mr-2 h-4 w-4" aria-hidden />
                      Move
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>
    </>
  );
}
