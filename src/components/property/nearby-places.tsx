"use client";

import { useCallback, useId, useState } from "react";
import { Compass, Loader2, TriangleAlert } from "lucide-react";
import {
  NEARBY_CATEGORIES,
  NEARBY_DISCLAIMER,
  NEARBY_FAILURE_MESSAGES,
  PLACES_ATTRIBUTION,
  formatDistance,
  nearbyFailureReason,
  nearbyRequest,
  toNearbyPlaces,
  type NearbyCategory,
  type NearbyFailure,
  type NearbyPlace,
} from "@/lib/maps/nearby-places";
import type { VerifiedCoordinates } from "@/lib/maps/google-3d";
import { importMapsLibrary, loadMaps } from "@/lib/maps/loader";

/**
 * What Google lists near a property.
 *
 * A list, not a carpet of pins. One category at a time, a handful of the
 * closest results in each, every one of them from Places with its own id — and
 * the page says plainly that this is a sample rather than a survey of the
 * neighbourhood. Proximity sells, which is exactly why it is kept this
 * disciplined.
 *
 * Nothing is fetched until the visitor picks a category, and nothing is cached
 * across properties: results belong to one coordinate.
 */

type Phase =
  | { k: "idle" }
  | { k: "loading"; categoryId: string }
  | { k: "ready"; categoryId: string; places: NearbyPlace[] }
  | { k: "failed"; categoryId: string; reason: NearbyFailure };

export function NearbyPlaces({
  center,
  apiKey,
}: {
  center: VerifiedCoordinates;
  apiKey: string;
}) {
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const statusId = useId();

  const select = useCallback(
    async (category: NearbyCategory) => {
      setPhase({ k: "loading", categoryId: category.id });
      try {
        await loadMaps(apiKey);
        const { Place } = await importMapsLibrary<{
          Place: {
            searchNearby: (request: unknown) => Promise<{ places: unknown[] }>;
          };
        }>("places");

        const { places: raw } = await Place.searchNearby(nearbyRequest(category, center));
        /* Everything that reaches the screen goes through this: a result
           without an id, a name or a position is dropped rather than pinned at
           the property, and nothing is invented to pad a thin category. */
        const places = toNearbyPlaces(raw as never[], category.id, center);
        setPhase({ k: "ready", categoryId: category.id, places });
      } catch (error) {
        setPhase({ k: "failed", categoryId: category.id, reason: nearbyFailureReason(error) });
      }
    },
    [apiKey, center],
  );

  const activeId = phase.k === "idle" ? null : phase.categoryId;

  return (
    <div className="mt-[var(--s-5)]">
      <p className="flex items-center gap-2">
        <Compass className="h-4 w-4 text-stage-muted" aria-hidden="true" />
        <span className="av-label text-stage-ink">What is nearby</span>
      </p>

      {/* Compact selector. One category at a time keeps the list readable and
          keeps the request count to what the visitor actually asked for. */}
      <div className="mt-[var(--s-4)] flex flex-wrap gap-2" role="group" aria-label="Nearby categories">
        {NEARBY_CATEGORIES.map((category) => {
          const active = category.id === activeId;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => void select(category)}
              aria-pressed={active}
              aria-describedby={statusId}
              className={[
                "av-label rounded-xs border px-3 py-[7px] text-[12px] transition-colors",
                active
                  ? "border-burgundy bg-burgundy text-paper"
                  : "border-rule-firm/50 text-stage-muted hover:border-rule-firm hover:text-stage-ink",
              ].join(" ")}
            >
              {category.label}
            </button>
          );
        })}
      </div>

      <div id={statusId} aria-live="polite" className="mt-[var(--s-4)]">
        {phase.k === "idle" && (
          <p className="text-[13px] leading-relaxed text-stage-muted">
            Pick a category to see what Google lists within walking distance.
          </p>
        )}

        {phase.k === "loading" && (
          <p className="flex items-center gap-2 text-[13px] text-stage-muted">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Looking up nearby places…
          </p>
        )}

        {phase.k === "failed" && (
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-stage-muted">
            <TriangleAlert className="mt-[2px] h-4 w-4 shrink-0" aria-hidden="true" />
            {/* Same discipline as the map: name the thing that is wrong. An
                error Google answered with proves the network is fine, so it is
                never reported as a network problem. */}
            {NEARBY_FAILURE_MESSAGES[phase.reason]}
          </p>
        )}

        {phase.k === "ready" && phase.places.length === 0 && (
          /* An empty category stays empty. Borrowing a result from another
             category, or widening the radius until something appears, would
             turn "Google lists nothing here" into a claim nobody checked. */
          <p className="text-[13px] leading-relaxed text-stage-muted">
            Google lists nothing in this category within walking distance of this location.
          </p>
        )}

        {phase.k === "ready" && phase.places.length > 0 && (
          <>
            <ul className="divide-y divide-rule-firm/30 border-y border-rule-firm/30">
              {phase.places.map((place) => (
                <li key={place.id} className="flex items-baseline justify-between gap-4 py-[10px]">
                  <span className="text-[14px] leading-snug text-stage-ink">{place.name}</span>
                  <span className="av-num shrink-0 text-[13px] text-stage-muted">
                    {formatDistance(place.metres)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="av-meta mt-[var(--s-3)] text-stage-muted opacity-80">{NEARBY_DISCLAIMER}</p>
          </>
        )}
      </div>

      <p className="av-meta mt-[var(--s-3)] text-ink-disabled">{PLACES_ATTRIBUTION}</p>
    </div>
  );
}
