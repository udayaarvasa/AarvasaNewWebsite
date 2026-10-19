"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Globe2, Loader2, LocateFixed, MapPin, Pause, Play, RotateCcw, RotateCw, TriangleAlert, ZoomIn, ZoomOut } from "lucide-react";
import {
  AREA_2D_NO_COVERAGE,
  MODEL_OVERLAY_LABEL,
  MODEL_OVERLAY_NOTE,
  MODEL_OVERLAY_PLACEMENT,
  MODEL_OVERLAY_UNAVAILABLE,
  AREA_2D_UNKNOWN,
  AREA_3D_READY,
  EXPLORE_AREA_HINTS,
  EXPLORE_AREA_MESSAGES,
  EXPLORE_AREA_NOTE,
  GOOGLE_ATTRIBUTION,
  exploreAreaCamera,
  exploreAreaMode,
  type ExploreAreaBlocker,
  type ExploreAreaMode,
  type VerifiedCoordinates,
  AREA_APPROXIMATE_LOCATION,
} from "@/lib/maps/google-3d";
import { importMapsLibrary, keyRefusedByGoogle, keyWasRejected, loadMaps } from "@/lib/maps/loader";

/**
 * Explore Area — the property's surroundings on Google's photorealistic 3D map.
 *
 * Nothing is loaded until the visitor asks. The Maps JavaScript API is a few
 * hundred kilobytes and starts streaming 3D tiles the moment it initialises, so
 * putting it on every project page would cost every visitor bandwidth for a
 * feature most of them never open — and would bill the account for a map nobody
 * looked at. One click, one script tag, once per page.
 *
 * Coverage is discovered, not assumed. Google's photorealistic mesh is
 * city-scale and much of the world has none. There is no API that answers "is
 * there 3D here", so the component asks for the 3D map and watches: if the
 * element never initialises, or reports an error, it falls back to the flat map
 * at the same coordinates rather than leaving an empty black viewport. A
 * visitor is never shown a broken 3D frame and told it is their area.
 */

/**
 * How long to wait for the map to come into view before giving up on it.
 *
 * Generous, because nothing is being blamed on anyone yet — this is only
 * waiting for the element to be on screen so that Google can start drawing.
 */
const COVERAGE_VISIBLE_WAIT_MS = 10_000;

/**
 * How long a *visible* element gets to produce a settled frame before the flat
 * map is tried. A covered location settles in roughly two seconds.
 */
const COVERAGE_TIMEOUT_MS = 15_000;

/**
 * Resolve once `element` is actually in the viewport, or after `timeout`.
 *
 * Resolving on timeout rather than rejecting is deliberate: a map that never
 * becomes visible is not a coverage fact, and the caller should go on to try
 * rather than conclude anything.
 */
function waitUntilVisible(element: Element, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    if (element.getBoundingClientRect().top < window.innerHeight) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      observer.disconnect();
      resolve();
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) done();
    });
    const timer = setTimeout(done, timeout);
    observer.observe(element);
  });
}

type Phase =
  | { k: "closed" }
  | { k: "loading" }
  /* `coverage` says what was actually established, and is only ever "absent"
     when Google's own element reported an error. A timeout leaves it
     "unknown", because a slow map is not a map that is not there. */
  | { k: "ready"; mode: "3d" }
  | { k: "ready"; mode: "2d"; coverage: "absent" | "unknown" }
  /* Named rather than free text, so each failure says which thing is wrong and
     who can fix it: a rejected key is ours, absent coverage is Google's and will
     not change on a retry. */
  | { k: "failed"; blocker: ExploreAreaBlocker };

/** The board's camera buttons: a turn of 45°, a tilt of 12°, a zoom of 30%. */
const CAMERA_MOVES = [
  { label: "Turn left", icon: RotateCcw, delta: { heading: -45 } },
  { label: "Turn right", icon: RotateCw, delta: { heading: 45 } },
  { label: "Look down from higher", icon: ArrowDown, delta: { tilt: -12 } },
  { label: "Look across, closer to the ground", icon: ArrowUp, delta: { tilt: 12 } },
  { label: "Zoom in", icon: ZoomIn, delta: { rangeFactor: 0.7 } },
  { label: "Zoom out", icon: ZoomOut, delta: { rangeFactor: 1.4 } },
] as const;

/** The 3D map's current camera, read from its own properties. */
function readCamera(element: HTMLElement | null) {
  const map = element as (HTMLElement & { heading?: number; tilt?: number; range?: number }) | null;
  if (!map) return null;
  return { map, heading: Number(map.heading) || 0, tilt: Number(map.tilt) || 0, range: Number(map.range) || 500 };
}

export function ExploreArea({
  name,
  location,
  coordinates,
  apiKey,
  approximate = false,
  modelOverlay = null,
}: {
  name: string;
  location: string;
  coordinates: VerifiedCoordinates | null;
  apiKey: string | null;
  /** The coordinate is locality precision: say so under the map. */
  approximate?: boolean;
  /**
   * A reconstructed model to stand at `coordinates`, or null.
   *
   * Null on the public page by construction: it is passed whatever the PUBLIC
   * resolver returned, and an INTERNAL asset resolves to nothing there. The
   * authorisation lives in the resolver that produced this, not in a check here.
   */
  modelOverlay?: { readonly url: string; readonly baseOffsetMetres: number } | null;
}) {
  const [phase, setPhase] = useState<Phase>({ k: "closed" });
  const hostRef = useRef<HTMLDivElement>(null);
  /** Put the camera back where it opened. Set once a map has mounted. */
  const recenterRef = useRef<(() => void) | null>(null);
  /** The 3D map, kept so the overlay can be attached and detached on demand. */
  const mapRef = useRef<(HTMLElement & Record<string, unknown>) | null>(null);
  const modelRef = useRef<HTMLElement | null>(null);
  const [showModel, setShowModel] = useState(true);
  const [modelFailed, setModelFailed] = useState(false);
  const statusId = useId();

  /* ── Camera controls: turn, tilt, zoom and a 360° orbit ────────────────
     Driven through the map's own heading/tilt/range properties, eased in a
     frame loop. (flyCameraTo returned without moving the camera here — see
     the recentre note below — so the properties are what move it.) */
  const animRef = useRef(0);
  const [orbiting, setOrbiting] = useState(false);
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    animRef.current = 0;
    setOrbiting(false);
  }, []);
  const moveCamera = useCallback(
    (delta: { heading?: number; tilt?: number; rangeFactor?: number }, ms = 650) => {
      stopCamera();
      const from = readCamera(mapRef.current);
      if (!from) return;
      const to = {
        heading: from.heading + (delta.heading ?? 0),
        tilt: Math.min(85, Math.max(0, from.tilt + (delta.tilt ?? 0))),
        range: Math.min(4000, Math.max(80, from.range * (delta.rangeFactor ?? 1))),
      };
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const e = 1 - Math.pow(1 - t, 3);
        const m = from.map as unknown as { heading: number; tilt: number; range: number };
        m.heading = (from.heading + (to.heading - from.heading) * e + 360) % 360;
        m.tilt = from.tilt + (to.tilt - from.tilt) * e;
        m.range = from.range + (to.range - from.range) * e;
        if (t < 1) animRef.current = requestAnimationFrame(step);
        else animRef.current = 0;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [stopCamera],
  );
  const toggleOrbit = useCallback(() => {
    if (orbiting) return stopCamera();
    const from = readCamera(mapRef.current);
    if (!from) return;
    setOrbiting(true);
    // One full turn around the subject in 24 s, then keep going until stopped.
    let last = performance.now();
    const step = (now: number) => {
      const m = from.map as unknown as { heading: number };
      m.heading = ((Number(m.heading) || 0) + ((now - last) / 24000) * 360) % 360;
      last = now;
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [orbiting, stopCamera]);
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const resolved: ExploreAreaMode = exploreAreaMode({ coordinates, apiKey });
  const resolvedCenter = resolved.kind === "unavailable" ? null : resolved.center;

  const open = useCallback(async () => {
    if (resolved.kind === "unavailable") return;
    setPhase({ k: "loading" });
    /* The host element has to exist before the map can be put into it. It is
       mounted from the start, hidden, rather than created by this state change:
       reading the ref in the same tick as setPhase found it null, and the click
       silently did nothing. */
    const host = hostRef.current;
    if (!host) {
      setPhase({ k: "failed", blocker: "LOAD_FAILED" });
      return;
    }
    try {
      await loadMaps(resolved.apiKey);

      /* The 3D map is a custom element. Importing the library is what defines
         it; if that throws, this deployment's key has no access to it and the
         flat map is the honest answer. */
      let is3d = true;
      try {
        await importMapsLibrary("maps3d");
      } catch {
        is3d = false;
      }

      host.replaceChildren();

      if (is3d && customElements.get("gmp-map-3d")) {
        /* Framed for the space it actually has, not for a nominal desktop. */
        const base = exploreAreaCamera(host.clientWidth || window.innerWidth);
        /* With a model to show, open close on it: aimed at its mid-height,
           near enough that the tower reads among its neighbours. */
        const narrow = (host.clientWidth || window.innerWidth) < 560;
        const camera = modelOverlay
          ? { range: narrow ? 360 : 460, tilt: 67, heading: base.heading, altitude: modelOverlay.baseOffsetMetres }
          : base;
        const map = document.createElement("gmp-map-3d") as HTMLElement & Record<string, unknown>;
        map.setAttribute("center", `${resolved.center.lat},${resolved.center.lng},${camera.altitude}`);
        map.setAttribute("range", String(camera.range));
        map.setAttribute("tilt", String(camera.tilt));
        map.setAttribute("heading", String(camera.heading));
        map.setAttribute("mode", "hybrid");
        map.style.width = "100%";
        map.style.height = "100%";
        map.setAttribute("aria-label", `Photorealistic 3D map of the area around ${name}, ${location}`);
        host.appendChild(map);

        /* The element will not draw while it is off-screen, so the clock cannot
           start until it is actually in the viewport.

           This was a real bug, and a bad one. On a phone the map mounts below
           the fold; Google never rendered a frame, never fired
           gmp-steadychange, and the timeout below concluded "no photorealistic
           3D coverage" — at coordinates that render perfectly on a wider screen.
           The page told mobile visitors a fact about Google's data that was
           false, and that the desktop page contradicted. Visible, a settled
           frame arrives in about two seconds. */
        map.scrollIntoView({ block: "nearest" });
        await waitUntilVisible(map, COVERAGE_VISIBLE_WAIT_MS);

        /* Coverage, discovered rather than assumed. The element emits
           gmp-steadychange once it has actually rendered a settled frame, which
           is the only signal that tiles exist here; gmp-error and a timeout both
           mean they do not. The element merely being *defined* proves nothing —
           it is defined whether or not anything loads, and treating that as
           success is how a failed map came to be labelled "photorealistic 3D". */
        const outcome = await new Promise<"settled" | "error" | "timeout">((resolve) => {
          const done = (value: "settled" | "error" | "timeout") => {
            clearTimeout(timer);
            map.removeEventListener("gmp-steadychange", onSteady);
            map.removeEventListener("gmp-error", onError);
            resolve(value);
          };
          const onSteady = () => done("settled");
          const onError = () => done("error");
          const timer = setTimeout(() => done("timeout"), COVERAGE_TIMEOUT_MS);
          map.addEventListener("gmp-steadychange", onSteady);
          map.addEventListener("gmp-error", onError);
        });

        /* A frame that never settled may be slow tiles — or a key Google refuses
           for this origin, which raises no event at all on the 3D path. Ask
           Google, once, only in that case. */
        if (keyWasRejected() || (outcome === "timeout" && (await keyRefusedByGoogle(resolved.apiKey)))) {
          host.replaceChildren();
          setPhase({ k: "failed", blocker: "INVALID_API_KEY" });
          return;
        }
        /* Only Google's own error sends us to the flat map.

           A timeout used to, and that was wrong twice over. The 3D tiles were
           arriving with 200s while the timer ran — 47 of them, measured — so
           the fallback was tearing down a working map and then describing the
           replacement as absent coverage. gmp-steadychange settled in about two
           seconds on one load and not within fifteen on the next, which makes it
           a fine signal for "ready" and no kind of evidence for "not there".

           So: the element stays unless Google says it failed. If it is drawing
           tiles, the visitor is looking at their surroundings, which is the
           entire point. */
        if (outcome === "error") {
          /* No settled 3D frame. That alone does not establish absent coverage —
             a rejected key looks identical — so the flat map is tried at the same
             point. If it renders, the 3D data genuinely is not there and the page
             says so while still showing the visitor their surroundings. */
          host.replaceChildren();
          try {
            const fallback = await mountFlatMap(host, resolved.center, name, location);
            recenterRef.current = () => fallback.recenter();
            /* Only Google saying so counts as absent coverage. */
            setPhase({ k: "ready", mode: "2d", coverage: "absent" });
          } catch {
            /* The flat map is what separates the two cases, and it is a better
               witness than Google's auth callback — which does not fire on the
               alpha 3D path, so it cannot be relied on to tell us a key was
               rejected.

               Reaching here means BOTH maps failed. Somewhere with no
               photorealistic 3D still serves the flat map perfectly well, so a
               flat map that also fails is not a coverage problem: it is the key
               or the network. Saying "not available at this location" here would
               blame Google for our own configuration and send whoever reads it
               looking in the wrong place. */
            setPhase({ k: "failed", blocker: keyWasRejected() ? "INVALID_API_KEY" : "LOAD_FAILED" });
          }
          return;
        }
        /* Panning away is the point of a map, so there has to be a way back.
           Without this a visitor who drags once has lost the property, which is
           the only reason the map is on the page. Assigning the camera
           properties is what actually moves it — flyCameraTo returned without
           error and without moving anything. */
        recenterRef.current = () => {
          (map as unknown as { stopCameraAnimation?: () => void }).stopCameraAnimation?.();
          map.center = { ...resolved.center, altitude: camera.altitude };
          map.heading = camera.heading;
          map.tilt = camera.tilt;
          map.range = camera.range;
        };
        mapRef.current = map;
        setPhase({ k: "ready", mode: "3d" });
        return;
      }

      /* The 3D library itself was unavailable, so there is nothing to say about
         coverage at this point either. */
      const flat = await mountFlatMap(host, resolved.center, name, location);
      recenterRef.current = () => flat.recenter();
      setPhase({ k: "ready", mode: "2d", coverage: "unknown" });
    } catch {
      // A rejected key is reported as such even when it surfaced as a throw.
      setPhase({ k: "failed", blocker: keyWasRejected() ? "INVALID_API_KEY" : "LOAD_FAILED" });
    }
  }, [resolved, name, location, modelOverlay]);

  /* The overlay, attached to the live 3D map and removed when switched off.
     Separate from the map's own lifecycle: the surroundings are the experience,
     and a model that cannot be placed must never take them down with it. */
  useEffect(() => {
    const map = mapRef.current;
    if (phase.k !== "ready" || phase.mode !== "3d" || !map || !modelOverlay) return;
    if (!showModel) {
      modelRef.current?.remove();
      modelRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const lib = await importMapsLibrary<{
          Model3DElement: new (o: Record<string, unknown>) => HTMLElement;
          AltitudeMode: Record<string, string>;
        }>("maps3d");
        if (cancelled) return;
        const model = new lib.Model3DElement({
          // Google's loader needs an absolute URL; a site-hosted model is relative.
          src: new URL(modelOverlay.url, window.location.origin).href,
          /* Anchored to the property's own coordinate, lifted so the model's
             base — not its centroid — meets the ground. */
          position: { ...(resolvedCenter as VerifiedCoordinates), altitude: modelOverlay.baseOffsetMetres },
          orientation: { ...MODEL_OVERLAY_PLACEMENT.orientation },
          scale: MODEL_OVERLAY_PLACEMENT.scale,
          altitudeMode: lib.AltitudeMode[MODEL_OVERLAY_PLACEMENT.altitudeMode],
        });
        model.addEventListener("gmp-error", () => setModelFailed(true));
        map.appendChild(model);
        modelRef.current = model;
      } catch {
        if (!cancelled) setModelFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, modelOverlay, showModel, resolvedCenter]);

  // Tear the map down when the section leaves, so its tile streaming stops.
  useEffect(() => {
    const host = hostRef.current;
    return () => host?.replaceChildren();
  }, []);

  if (resolved.kind === "unavailable") {
    return (
      <div className="max-w-[60ch] border border-rule-firm bg-paper-raised p-[var(--s-6)]">
        <p className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-ink-disabled" aria-hidden="true" />
          <span className="av-label text-ink-muted">Area view unavailable</span>
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{resolved.message}</p>
      </div>
    );
  }

  return (
    <div>
      {phase.k === "closed" && (
        <div className="border border-rule-firm bg-paper-raised p-[var(--s-6)]">
          <p className="max-w-[56ch] text-[15px] leading-relaxed">
            {modelOverlay ? `See ${name} standing in its surroundings.` : "See this property in its surroundings."}
          </p>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-ink-muted">
            {EXPLORE_AREA_NOTE}
          </p>
          <button
            type="button"
            onClick={() => void open()}
            aria-describedby={statusId}
            className="av-label mt-[var(--s-5)] inline-flex items-center gap-2 rounded-xs border border-burgundy bg-burgundy px-4 py-[9px] text-paper transition-opacity hover:opacity-90"
          >
            <Globe2 className="h-4 w-4" aria-hidden="true" />
            {modelOverlay ? "Open the 3D view" : "Explore area"}
          </button>
        </div>
      )}

      {/* Always mounted, so the click handler has somewhere to put the map. */}
      <div
        hidden={phase.k === "closed"}
        className="relative aspect-[16/10] w-full overflow-hidden border border-rule-firm bg-stage"
      >
        <div ref={hostRef} className="absolute inset-0 [&>*]:h-full [&>*]:w-full" />
        {phase.k === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-stage-muted">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span className="text-[14px]">Loading the area…</span>
          </div>
        )}
        {phase.k === "ready" && phase.mode === "3d" && (
          <div
            role="toolbar"
            aria-label={`Move around ${name}`}
            className="absolute bottom-3 left-1/2 z-[2] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/55 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-md"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {CAMERA_MOVES.map(({ label, icon: Icon, delta }) => (
              <button
                key={label}
                type="button"
                onClick={() => moveCamera(delta)}
                aria-label={label}
                title={label}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/20" />
            <button
              type="button"
              onClick={toggleOrbit}
              aria-pressed={orbiting}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold text-[var(--action-ink)] [background:var(--action)]"
            >
              {orbiting ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
              {orbiting ? "Stop" : "Orbit 360°"}
            </button>
          </div>
        )}
        {phase.k === "ready" && phase.mode === "3d" && (
          <p className="pointer-events-none absolute right-3 top-3 z-[2] hidden rounded-full bg-black/45 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur-md md:block">
            Drag to move · Right-drag or Ctrl-drag to turn and tilt · Scroll to zoom
          </p>
        )}
        {phase.k === "ready" && (
          /* Deliberately a real button rather than a gesture hint: the gesture
             that gets you back does not exist, and on a touch screen there is
             nothing to discover. */
          <button
            type="button"
            onClick={() => {
              stopCamera();
              recenterRef.current?.();
            }}
            className="av-label absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-xs border border-rule-firm/60 bg-paper/90 px-2.5 py-1.5 text-[11px] text-ink backdrop-blur-sm transition-opacity hover:opacity-90"
          >
            <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            Recentre
          </button>
        )}
        {phase.k === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-stage-muted">
            <TriangleAlert className="h-6 w-6" aria-hidden="true" />
            <p className="max-w-[44ch] text-[14px]">{EXPLORE_AREA_MESSAGES[phase.blocker]}</p>
            {EXPLORE_AREA_HINTS[phase.blocker] && (
              <p className="max-w-[44ch] text-[13px] opacity-80">{EXPLORE_AREA_HINTS[phase.blocker]}</p>
            )}
          </div>
        )}
      </div>

      {/* The overlay control. Only where an authorised resolver supplied a
          model, and only once a 3D scene exists to stand it in. The note is not
          dismissible: a reconstruction among Google's real buildings looks
          surveyed, and it is not. */}
      {modelOverlay && phase.k === "ready" && phase.mode === "3d" && (
        <div className="mt-[var(--s-3)] flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showModel && !modelFailed}
              disabled={modelFailed}
              onChange={(e) => setShowModel(e.target.checked)}
              className="h-3.5 w-3.5 accent-burgundy"
            />
            <span className="av-label text-[11px] text-stage-ink">{MODEL_OVERLAY_LABEL}</span>
          </label>
          <span className="av-meta text-ink-disabled">
            {modelFailed ? MODEL_OVERLAY_UNAVAILABLE : MODEL_OVERLAY_NOTE}
          </span>
        </div>
      )}

      {approximate && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-stage-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {AREA_APPROXIMATE_LOCATION}
        </p>
      )}
      <p id={statusId} aria-live="polite" className="av-meta mt-2 text-ink-disabled">
        {phase.k === "ready"
          ? phase.mode === "3d"
            ? `${AREA_3D_READY} ${GOOGLE_ATTRIBUTION}`
            : `${phase.coverage === "absent" ? AREA_2D_NO_COVERAGE : AREA_2D_UNKNOWN} ${GOOGLE_ATTRIBUTION}`
          : phase.k === "loading"
            ? "Loading the area map."
            : GOOGLE_ATTRIBUTION}
      </p>
    </div>
  );
}

/** The flat map, used wherever photorealistic 3D has no coverage. */
async function mountFlatMap(
  host: HTMLElement,
  center: VerifiedCoordinates,
  name: string,
  location: string,
): Promise<{ recenter: () => void }> {
  if (keyWasRejected()) throw new Error("maps key rejected");
  const maps = await importMapsLibrary<{
    Map: new (el: HTMLElement, options: Record<string, unknown>) => unknown;
  }>("maps");
  const marker = await importMapsLibrary<{
    AdvancedMarkerElement: new (options: Record<string, unknown>) => unknown;
  }>("marker");
  const FLAT_ZOOM = 16;
  const map = new maps.Map(host, {
    center,
    zoom: FLAT_ZOOM,
    mapTypeId: "hybrid",
    mapId: "aarvasa-area",
    disableDefaultUI: false,
  }) as { setCenter: (c: VerifiedCoordinates) => void; setZoom: (z: number) => void };
  host.setAttribute("aria-label", `Map of the area around ${name}, ${location}`);
  new marker.AdvancedMarkerElement({ map, position: center, title: name });
  return {
    recenter: () => {
      map.setCenter(center);
      map.setZoom(FLAT_ZOOM);
    },
  };
}
