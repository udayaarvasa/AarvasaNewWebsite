"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Heart, Scale } from "lucide-react";
import type { PropertyListing } from "@/types/property";
import { currencyForCountry, formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { Plate, Status } from "@/components/av/primitives";
import { useCompare } from "./compare-store";
import toast from "react-hot-toast";

/**
 * A property as a plate, not a card: image, hairline, hanging text.
 *
 * Deliberately does not render roi, aiScore, riskLevel or tokenized. Those
 * columns still exist on the model and in the API response; this system makes
 * no yield or return claim, so it shows specification instead.
 *
 * No capability marks here: the listings endpoint does not select mediaAssets,
 * so there is no published-media fact to show. Immersive availability is stated
 * on the project page, where it is read from real gating.
 */

const TYPE_LABEL: Record<string, string> = {
  APARTMENT: "Apartment",
  VILLA: "Villa",
  OFFICE: "Office",
  LAND: "Land",
  STUDIO: "Studio",
  PENTHOUSE: "Penthouse",
  PLOT: "Plot",
  COMMERCIAL: "Commercial",
};

export function DbPropertyCard({
  property,
  compact = false,
}: {
  property: PropertyListing;
  compact?: boolean;
}) {
  const [isFav, setIsFav] = useState(property.isFavorited ?? false);
  const [favLoading, setFavLoading] = useState(false);
  const compare = useCompare();
  const selected = compare.has(property.id);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id }),
      });
      if (res.status === 401) {
        toast.error("Sign in to save properties");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setIsFav(data.isFavorited);
        toast.success(data.isFavorited ? "Saved" : "Removed from saved");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setFavLoading(false);
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected && compare.full) {
      toast.error("Comparison holds three properties");
      return;
    }
    compare.toggle(property.id);
  };

  const image = property.images[0] ?? null;

  return (
    <div
      className="group lux-gold-border relative overflow-hidden rounded-[24px] bg-paper-raised transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:shadow-[0_40px_80px_rgba(0,0,0,0.55)]"
      data-hov
    >
      <Link href={`/property/${property.id}`} className="block">
        <Plate ratio={compact ? "thumb" : "card"}>
          {image ? (
            <Image
              src={image}
              alt={property.title}
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
              className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
            />
          ) : (
            /* No photography for this property. A typographic panel, never a
               stock image standing in for a building that has not been shot. */
            <div className="absolute inset-0 flex items-end bg-paper-sunken p-4">
              <span className="av-meta text-ink-disabled">Not yet photographed</span>
            </div>
          )}
        </Plate>

        <div className="p-5">
        <h3 className="av-display text-[27px] font-normal leading-[1.05]">{property.title}</h3>
        <p className="mt-[2px] text-[13px] text-ink-muted">
          {property.location}
          {property.city ? `, ${property.city}` : ""}
        </p>
        <p className="av-num mt-3 text-[17px] font-semibold text-gold-ink">
          {formatCurrency(property.price, currencyForCountry(property.country))}
          <span className="ml-2 font-normal text-ink-muted">
            {TYPE_LABEL[property.propertyType] ?? property.propertyType}
          </span>
        </p>

        <dl className="mt-3 flex gap-[var(--s-5)] border-t border-rule pt-[10px]">
          {property.bedrooms > 0 && (
            <div>
              <dt className="av-label text-ink-muted">Beds</dt>
              <dd className="av-num text-[13px] font-semibold">{property.bedrooms}</dd>
            </div>
          )}
          {property.bathrooms > 0 && (
            <div>
              <dt className="av-label text-ink-muted">Baths</dt>
              <dd className="av-num text-[13px] font-semibold">{property.bathrooms}</dd>
            </div>
          )}
          {property.area > 0 && (
            <div>
              <dt className="av-label text-ink-muted">Area</dt>
              <dd className="av-num text-[13px] font-semibold">
                {property.area.toLocaleString()} sq ft
              </dd>
            </div>
          )}
        </dl>

        {/* Who listed it, from the record itself. Labelled by the capacity the
            account actually holds rather than calling every lister a developer. */}
        {property.owner?.name && (
          <p className="mt-2 text-[12.5px] text-ink-muted">
            {property.owner.role === "BUILDER"
              ? "Developer"
              : property.owner.role === "AGENT"
                ? "Listed by agent"
                : "Listed by"}
            : <span className="text-ink">{property.owner.name}</span>
          </p>
        )}

        {(property.verified || property.status !== "ACTIVE") && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {property.verified && <Status tone="ready">Verified listing</Status>}
            {property.status !== "ACTIVE" && <Status tone="pending">{property.status}</Status>}
          </div>
        )}
        </div>
      </Link>

      {/* Actions sit above the link, not inside it */}
      <div className="absolute right-0 top-0 flex gap-1.5 p-3">
        <button
          type="button"
          onClick={handleCompare}
          disabled={!selected && compare.full}
          aria-pressed={selected}
          aria-label={selected ? "Remove from comparison" : "Add to comparison"}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
            selected
              ? "border-gold bg-gold text-[var(--action-ink)]"
              : "border-white/20 bg-black/45 text-stage-ink hover:border-gold hover:text-gold",
            !selected && compare.full && "cursor-not-allowed opacity-50",
          )}
        >
          <Scale className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleFavorite}
          disabled={favLoading}
          aria-pressed={isFav}
          aria-label={isFav ? "Remove from saved" : "Save property"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-stage-ink backdrop-blur-md transition-colors hover:border-gold hover:text-gold"
        >
          <Heart className={cn("h-3.5 w-3.5", isFav && "fill-burgundy text-burgundy")} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
