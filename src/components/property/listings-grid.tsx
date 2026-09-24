"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { DbPropertyCard } from "@/components/property/db-property-card";
import { PropertyGridSkeleton } from "@/components/property/property-skeleton";
import { PropertyFilters } from "@/components/property/property-filters";
import { COMPARE_MAX, useCompare } from "@/components/property/compare-store";
import { Plate, Status } from "@/components/av/primitives";
import { currencyForCountry, formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { PropertyListing } from "@/types/property";

/**
 * Discovery: a filter rail, two ways of reading the results, and a shortlist
 * tray that follows you down the page.
 *
 * Gallery is the editorial read; Table is the dense one for scanning many rows
 * at once. Table is withheld below lg — a five-column row cannot be made good
 * on a phone, and Gallery answers the same need there.
 */

type View = "gallery" | "table";

export function ListingsGrid() {
  const searchParams = useSearchParams();
  const compare = useCompare();
  const [view, setView] = useState<View>("gallery");

  /* One piece of state, written only after the request resolves, and the
     loading flag derived from whether it matches the query we are showing.
     Nothing setStates synchronously inside the effect. */
  const queryKey = searchParams.toString();
  const [result, setResult] = useState<{
    key: string;
    properties: PropertyListing[];
    total: number;
    page: number;
    totalPages: number;
  } | null>(null);

  const loading = !result || result.key !== queryKey;
  const properties = result?.properties ?? [];
  const total = result?.total ?? 0;
  const page = result?.page ?? 1;
  const totalPages = result?.totalPages ?? 1;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(queryKey);
      if (!params.has("page")) params.set("page", "1");
      try {
        const res = await fetch(`/api/properties?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setResult({
            key: queryKey,
            properties: data.properties,
            total: data.total,
            page: data.page,
            totalPages: data.totalPages,
          });
        }
      } catch (err) {
        console.error("Failed to fetch properties:", err);
        if (!cancelled) {
          setResult({ key: queryKey, properties: [], total: 0, page: 1, totalPages: 1 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  const selected = properties.filter((p) => compare.has(p.id));

  return (
    <div className="grid grid-cols-1 items-start gap-[var(--s-8)] lg:grid-cols-[var(--rail)_minmax(0,1fr)]">
      <PropertyFilters />

      <div>
        {/* Result bar */}
        <div className="mb-[var(--s-5)] flex flex-wrap items-center gap-[var(--s-3)] border-b border-rule pb-[var(--s-4)]">
          <p className="av-num text-[13px] text-ink-muted">
            {loading ? "Loading…" : `${total} ${total === 1 ? "property" : "properties"}`}
          </p>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <span className="av-label text-ink-muted">View</span>
            {(["gallery", "table"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-xs border px-[11px] py-[6px] text-[12.5px] font-medium capitalize transition-colors",
                  view === v
                    ? "border-burgundy bg-burgundy-wash text-burgundy"
                    : "border-rule bg-paper-raised text-ink-muted hover:text-ink",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <PropertyGridSkeleton count={6} />
        ) : properties.length === 0 ? (
          <div className="border border-rule bg-paper-raised px-6 py-20 text-center">
            <h3 className="av-display text-[24px]">No properties match those filters</h3>
            <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] text-ink-muted">
              Try widening the price range or clearing a filter. Every listing here comes from the
              developer or their appointed channel partner.
            </p>
          </div>
        ) : view === "table" ? (
          <div className="hidden border-t border-rule-firm lg:block">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/property/${p.id}`}
                className="grid grid-cols-[120px_1.4fr_1fr_140px] items-center gap-[var(--s-5)] border-b border-rule px-2 py-[var(--s-3)] transition-colors hover:bg-paper-raised"
              >
                <Plate ratio="thumb" className="rounded-sm">
                  {p.images[0] ? (
                    <Image src={p.images[0]} alt="" fill sizes="120px" className="object-cover" />
                  ) : null}
                </Plate>
                <div className="min-w-0">
                  <div className="av-display truncate text-[21px]">{p.title}</div>
                  <div className="truncate text-[13px] text-ink-muted">
                    {p.location}
                    {p.city ? `, ${p.city}` : ""}
                  </div>
                </div>
                <div className="text-[13px] text-ink-muted">
                  {p.bedrooms > 0 && <>{p.bedrooms} bed · </>}
                  {p.area > 0 && <>{p.area.toLocaleString()} sq ft</>}
                  {p.verified && (
                    <div className="mt-1">
                      <Status tone="ready">Verified</Status>
                    </div>
                  )}
                </div>
                <div className="av-num text-right text-[15px] font-semibold">
                  {formatCurrency(p.price, currencyForCountry(p.country))}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid gap-[var(--s-8)] sm:grid-cols-2 xl:grid-cols-3">
            {properties.map((p) => (
              <DbPropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-[var(--s-8)] flex items-center justify-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`?${new URLSearchParams({
                  ...Object.fromEntries(searchParams),
                  page: p.toString(),
                }).toString()}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "av-num flex h-9 w-9 items-center justify-center rounded-xs border text-[13px] transition-colors",
                  p === page
                    ? "border-burgundy bg-burgundy text-paper"
                    : "border-rule text-ink-muted hover:border-rule-firm hover:text-ink",
                )}
              >
                {p}
              </a>
            ))}
          </div>
        )}

        {/* ── Comparison tray ─────────────────────────────────────────────
            Sticky at the foot of the results while a shortlist exists. */}
        {compare.ids.length > 0 && (
          <div className="sticky bottom-0 z-40 mt-[var(--s-6)] flex flex-wrap items-center gap-[var(--s-3)] rounded-t-sm border border-b-0 border-rule bg-paper-raised px-[var(--s-4)] py-[var(--s-3)] pb-[calc(var(--s-3)+env(safe-area-inset-bottom,0px))] shadow-tray">
            <span className="av-label text-ink-muted">Compare</span>
            {selected.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-2 rounded-xs border border-rule py-1 pl-1 pr-2 text-[12.5px] font-medium"
              >
                <span className="relative block h-[26px] w-[34px] flex-none overflow-hidden rounded-[2px] bg-paper-sunken">
                  {p.images[0] ? (
                    <Image src={p.images[0]} alt="" fill sizes="34px" className="object-cover" />
                  ) : null}
                </span>
                <span className="hidden max-w-[16ch] truncate sm:inline">{p.title}</span>
                <button
                  type="button"
                  onClick={() => compare.remove(p.id)}
                  aria-label={`Remove ${p.title} from comparison`}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            {compare.ids.length < COMPARE_MAX && (
              <span className="hidden rounded-xs border border-dashed border-rule-firm px-[13px] py-2 text-[13px] text-ink-muted sm:inline">
                Add {COMPARE_MAX - compare.ids.length} more
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={compare.clear}
                className="av-label text-ink-muted transition-colors hover:text-ink"
              >
                Clear
              </button>
              <Link
                href={`/compare?ids=${compare.ids.join(",")}`}
                className="av-label rounded-xs bg-burgundy px-4 py-[10px] text-paper transition-colors hover:bg-burgundy-deep"
              >
                Compare {compare.ids.length}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
