"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Globe2, Loader2, MapPin, TriangleAlert } from "lucide-react";
import {
  EXPLORE_AREA_CAMERA,
  EXPLORE_AREA_HINTS,
  EXPLORE_AREA_MESSAGES,
  EXPLORE_AREA_NOTE,
  GOOGLE_ATTRIBUTION,
  exploreAreaMode,
  type ExploreAreaBlocker,
  type ExploreAreaMode,
  type VerifiedCoordinates,
} from "@/lib/maps/google-3d";
import { importMapsLibrary, keyWasRejected, loadMaps } from "@/lib/maps/loader";

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

type Phase =
  | { k: "closed" }
  | { k: "loading" }
  | { k: "ready"; mode: "3d" | "2d" }
  /* Named rather than free text, so each failure says which thing is wrong and
     who can fix it: a rejected key is ours, absent coverage is Google's and will
     not change on a retry. */
  | { k: "failed"; blocker: ExploreAreaBlocker };

export function ExploreArea({
  name,
  location,
  coordinates,
  apiKey,
}: {
  name: string;
  location: string;
  coordinates: VerifiedCoordinates | null;
  apiKey: string | null;
}) {
  const [phase, setPhase] = useState<Phase>({ k: "closed" });
  const hostRef = useRef<HTMLDivElement>(null);
  const statusId = useId();

  const resolved: ExploreAreaMode = exploreAreaMode({ coordinates, apiKey });

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
        const map = document.createElement("gmp-map-3d") as HTMLElement & Record<string, unknown>;
        map.setAttribute("center", `${resolved.center.lat},${resolved.center.lng},${EXPLORE_AREA_CAMERA.altitude}`);
        map.setAttribute("range", String(EXPLORE_AREA_CAMERA.range));
        map.setAttribute("tilt", String(EXPLORE_AREA_CAMERA.tilt));
        map.setAttribute("heading", String(EXPLORE_AREA_CAMERA.heading));
        map.setAttribute("mode", "hybrid");
        map.style.width = "100%";
        map.style.height = "100%";
        map.setAttribute("aria-label", `Photorealistic 3D map of the area around ${name}, ${location}`);
        host.appendChild(map);

        /* Coverage, discovered rather than assumed. The element emits
           gmp-steadychange once it has actually rendered a settled frame, which
           is the only signal that tiles exist here; gmp-error and a timeout both
           mean they do not. The element merely being *defined* proves nothing —
           it is defined whether or not anything loads, and treating that as
           success is how a failed map came to be labelled "photorealistic 3D". */
        const rendered = await new Promise<boolean>((resolve) => {
          const done = (value: boolean) => {
            clearTimeout(timer);
            map.removeEventListener("gmp-steadychange", onSteady);
            map.removeEventListener("gmp-error", onError);
            resolve(value);
          };
          const onSteady = () => done(true);
          const onError = () => done(false);
          const timer = setTimeout(() => done(false), 8000);
          map.addEventListener("gmp-steadychange", onSteady);
          map.addEventListener("gmp-error", onError);
        });

        if (keyWasRejected()) {
          host.replaceChildren();
          setPhase({ k: "failed", blocker: "INVALID_API_KEY" });
          return;
        }
        if (!rendered) {
          /* No settled 3D frame. That alone does not establish absent coverage —
             a rejected key looks identical — so the flat map is tried at the same
             point. If it renders, the 3D data genuinely is not there and the page
             says so while still showing the visitor their surroundings. */
          host.replaceChildren();
          try {
            await mountFlatMap(host, resolved.center, name, location);
            setPhase({ k: "ready", mode: "2d" });
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
        setPhase({ k: "ready", mode: "3d" });
        return;
      }

      await mountFlatMap(host, resolved.center, name, location);
      setPhase({ k: "ready", mode: "2d" });
    } catch {
      // A rejected key is reported as such even when it surfaced as a throw.
      setPhase({ k: "failed", blocker: keyWasRejected() ? "INVALID_API_KEY" : "LOAD_FAILED" });
    }
  }, [resolved, name, location]);

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
            See this property in its surroundings.
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
            Explore area
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

      <p id={statusId} aria-live="polite" className="av-meta mt-2 text-ink-disabled">
        {phase.k === "ready"
          ? phase.mode === "3d"
            ? `Photorealistic 3D. ${GOOGLE_ATTRIBUTION}`
            : `No photorealistic 3D coverage here, so this is the flat map. ${GOOGLE_ATTRIBUTION}`
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
): Promise<void> {
  if (keyWasRejected()) throw new Error("maps key rejected");
  const maps = await importMapsLibrary<{
    Map: new (el: HTMLElement, options: Record<string, unknown>) => unknown;
  }>("maps");
  const marker = await importMapsLibrary<{
    AdvancedMarkerElement: new (options: Record<string, unknown>) => unknown;
  }>("marker");
  const map = new maps.Map(host, {
    center,
    zoom: 16,
    mapTypeId: "hybrid",
    mapId: "aarvasa-area",
    disableDefaultUI: false,
  });
  host.setAttribute("aria-label", `Map of the area around ${name}, ${location}`);
  new marker.AdvancedMarkerElement({ map, position: center, title: name });
}
