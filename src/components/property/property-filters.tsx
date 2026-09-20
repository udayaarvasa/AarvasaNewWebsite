"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filter rail on paper — a sticky panel at lg and up, a sheet below it.
 *
 * Every control writes to the URL, so a filtered view is shareable and the
 * back button behaves. The API's roi_desc sort is deliberately not offered:
 * this system makes no yield claim, so it does not rank by one.
 */

const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "STUDIO", label: "Studio" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "PLOT", label: "Plot" },
  { value: "OFFICE", label: "Office" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "featured", label: "Featured" },
];

const BEDROOMS = ["1", "2", "3", "4"];

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rule py-[var(--s-3)] first:border-t-0 first:pt-0">
      <span className="av-label mb-2 block text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

export function PropertyFilters({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const current = {
    search: searchParams.get("search") || "",
    city: searchParams.get("city") || "",
    propertyType: searchParams.get("propertyType") || "",
    sortBy: searchParams.get("sortBy") || "newest",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    bedrooms: searchParams.get("bedrooms") || "",
    verified: searchParams.get("verified") || "",
  };

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page"); // reset pagination on filter change
      router.push(`/listings?${params.toString()}`);
    },
    [router, searchParams],
  );

  const activeCount = Object.entries(current).filter(
    ([k, v]) => v && !(k === "sortBy" && v === "newest"),
  ).length;

  const toggleClass = (on: boolean) =>
    cn(
      "rounded-xs border px-[11px] py-[7px] text-[12.5px] font-medium transition-colors duration-200",
      on
        ? "border-burgundy bg-burgundy-wash text-burgundy"
        : "border-rule bg-paper-raised text-ink-muted hover:border-rule-firm hover:text-ink",
    );

  const body = (
    <>
      <Group label="Search">
        <div className="flex items-center gap-2 rounded-xs border border-rule bg-paper px-3 py-2 focus-within:border-burgundy">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" aria-hidden="true" />
          <label htmlFor="filter-search" className="sr-only">
            Search properties
          </label>
          <input
            id="filter-search"
            defaultValue={current.search}
            placeholder="Project, city or developer"
            onKeyDown={(e) => {
              if (e.key === "Enter") update("search", (e.target as HTMLInputElement).value.trim());
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-muted"
          />
        </div>
      </Group>

      <Group label="Sort">
        <div className="flex flex-wrap gap-1">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={current.sortBy === o.value}
              onClick={() => update("sortBy", o.value === "newest" ? "" : o.value)}
              className={toggleClass(current.sortBy === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Group>

      <Group label="Type">
        <div className="flex flex-wrap gap-1">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={current.propertyType === t.value}
              onClick={() => update("propertyType", current.propertyType === t.value ? "" : t.value)}
              className={toggleClass(current.propertyType === t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Group>

      <Group label="Bedrooms">
        <div className="flex flex-wrap gap-1">
          {BEDROOMS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={current.bedrooms === b}
              onClick={() => update("bedrooms", current.bedrooms === b ? "" : b)}
              className={toggleClass(current.bedrooms === b)}
            >
              {b}+
            </button>
          ))}
        </div>
      </Group>

      <Group label="Price">
        <div className="flex items-center gap-2">
          <label htmlFor="filter-min" className="sr-only">
            Minimum price
          </label>
          <input
            id="filter-min"
            type="number"
            inputMode="numeric"
            defaultValue={current.minPrice}
            placeholder="Min"
            onBlur={(e) => update("minPrice", e.target.value)}
            className="av-num w-full min-w-0 rounded-xs border border-rule bg-paper px-3 py-2 text-[13px] outline-none focus:border-burgundy"
          />
          <span className="text-ink-muted">–</span>
          <label htmlFor="filter-max" className="sr-only">
            Maximum price
          </label>
          <input
            id="filter-max"
            type="number"
            inputMode="numeric"
            defaultValue={current.maxPrice}
            placeholder="Max"
            onBlur={(e) => update("maxPrice", e.target.value)}
            className="av-num w-full min-w-0 rounded-xs border border-rule bg-paper px-3 py-2 text-[13px] outline-none focus:border-burgundy"
          />
        </div>
      </Group>

      <Group label="Listing">
        <label className="flex cursor-pointer items-center gap-2 py-1 text-[13px]">
          <input
            type="checkbox"
            checked={current.verified === "true"}
            onChange={(e) => update("verified", e.target.checked ? "true" : "")}
            className="h-[15px] w-[15px] accent-[var(--burgundy)]"
          />
          Verified only
        </label>
      </Group>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => router.push("/listings")}
          className="av-label mt-[var(--s-3)] w-full rounded-xs border border-rule-firm py-[10px] text-ink transition-colors hover:bg-paper-sunken"
        >
          Reset {activeCount} filter{activeCount === 1 ? "" : "s"}
        </button>
      )}
    </>
  );

  return (
    <div className={className}>
      {/* Sheet trigger — below lg, filters are their own screen */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-sm border border-rule bg-paper-raised px-4 py-3 text-[13px] font-semibold lg:hidden"
      >
        Filters{activeCount > 0 ? ` · ${activeCount} applied` : ""}
        <span className="av-label text-ink-muted">{open ? "Done" : "Edit"}</span>
      </button>

      <div
        className={cn(
          "rounded-sm border border-rule bg-paper-raised p-[var(--s-4)] lg:sticky lg:top-[calc(var(--nav-h)+var(--s-4))] lg:mt-0 lg:block",
          open ? "mt-3 block" : "hidden",
        )}
      >
        {body}
      </div>
    </div>
  );
}
