"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plate, Status } from "@/components/av/primitives";
import { currencyForCountry, formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { PropertyListing } from "@/types/property";

/**
 * EVALUATE — side by side.
 *
 * Every figure is re-read from /api/properties by id, so nothing here can
 * drift from the database. Rows the developer has not filed read "—"; they are
 * never estimated.
 *
 * The green mark means "better on this row alone" — a lower price, more area,
 * a shorter journey. It is not a score, not a ranking and not advice, and it
 * is only ever applied to a field the data actually supports.
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

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Available",
  INACTIVE: "Not listed",
  SOLD: "Sold",
  RENTED: "Rented",
  PENDING: "Pending",
};

type Row = {
  label: string;
  values: (string | null)[];
  best?: number[];
};

function buildRows(items: PropertyListing[]): { group: string; rows: Row[] }[] {
  const val = <T,>(pick: (p: PropertyListing) => T, fmt: (v: T) => string | null) =>
    items.map((p) => fmt(pick(p)));

  /* Lowest price and largest area are facts about the numbers, not opinions. */
  const prices = items.map((p) => p.price);
  const minPrice = Math.min(...prices.filter((n) => n > 0));
  const areas = items.map((p) => p.area);
  const maxArea = Math.max(...areas);

  return [
    {
      group: "Essentials",
      rows: [
        {
          label: "Price",
          values: items.map((p) =>
            p.price > 0 ? formatCurrency(p.price, currencyForCountry(p.country)) : null,
          ),
          best: prices.map((n, i) => (n === minPrice && n > 0 ? i : -1)).filter((i) => i >= 0),
        },
        {
          label: "Type",
          values: val((p) => p.propertyType, (v) => TYPE_LABEL[v] ?? v),
        },
        {
          label: "Area",
          values: val((p) => p.area, (v) => (v > 0 ? `${v.toLocaleString()} sq ft` : null)),
          best: areas.map((n, i) => (n === maxArea && n > 0 ? i : -1)).filter((i) => i >= 0),
        },
        { label: "Bedrooms", values: val((p) => p.bedrooms, (v) => (v > 0 ? String(v) : null)) },
        { label: "Bathrooms", values: val((p) => p.bathrooms, (v) => (v > 0 ? String(v) : null)) },
      ],
    },
    {
      group: "Location",
      rows: [
        { label: "Locality", values: val((p) => p.location, (v) => v || null) },
        { label: "City", values: val((p) => p.city, (v) => v || null) },
        { label: "State", values: val((p) => p.state, (v) => v || null) },
        { label: "Country", values: val((p) => p.country, (v) => v || null) },
      ],
    },
    {
      group: "Listing",
      rows: [
        {
          label: "Status",
          values: val((p) => p.status, (v) => STATUS_LABEL[v] ?? v),
        },
        { label: "Verified", values: val((p) => p.verified, (v) => (v ? "Yes" : "No")) },
        {
          label: "Listed by",
          values: val((p) => p.owner?.name ?? null, (v) => v),
        },
      ],
    },
    {
      group: "Amenities",
      rows: [
        {
          label: "Listed amenities",
          values: val((p) => p.amenities, (v) => (v.length > 0 ? v.join(", ") : null)),
        },
      ],
    },
  ];
}

export function CompareView() {
  const searchParams = useSearchParams();
  const idsKey = searchParams.get("ids") || "";
  const ids = idsKey.split(",").filter(Boolean).slice(0, 3);
  const [diffOnly, setDiffOnly] = useState(false);

  /* Written only after the requests resolve; loading is derived. */
  const [result, setResult] = useState<{ key: string; items: PropertyListing[] } | null>(null);
  const loading = ids.length > 0 && (!result || result.key !== idsKey);
  const items = result?.key === idsKey ? result.items : [];

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        // Read each property back by id so the table always reflects the
        // database rather than whatever the tray was carrying.
        const results = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`/api/properties/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return (data.property ?? data.data ?? null) as PropertyListing | null;
          }),
        );
        if (cancelled) return;
        setResult({ key: idsKey, items: results.filter((p): p is PropertyListing => Boolean(p)) });
      } catch (err) {
        console.error("Failed to load comparison:", err);
        if (!cancelled) setResult({ key: idsKey, items: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (loading) {
    return <p className="text-[13.5px] text-ink-muted">Loading comparison…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="border border-rule bg-paper-raised px-6 py-16 text-center">
        <h2 className="av-display text-[26px]">Nothing to compare yet</h2>
        <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] text-ink-muted">
          Add up to three properties from the listings page and they will line up here on price,
          specification and locality.
        </p>
        <Link
          href="/listings"
          className="av-label mt-[var(--s-5)] inline-flex rounded-xs bg-burgundy px-5 py-3 text-paper transition-colors hover:bg-burgundy-deep"
        >
          Browse properties
        </Link>
      </div>
    );
  }

  const groups = buildRows(items);
  const cols = items.length;

  return (
    <>
      <div className="mb-[var(--s-5)] flex flex-wrap items-center gap-[var(--s-2)]">
        <button
          type="button"
          aria-pressed={diffOnly}
          onClick={() => setDiffOnly((v) => !v)}
          className={cn(
            "rounded-xs border px-[11px] py-[7px] text-[12.5px] font-medium transition-colors",
            diffOnly
              ? "border-burgundy bg-burgundy-wash text-burgundy"
              : "border-rule bg-paper-raised text-ink-muted hover:text-ink",
          )}
        >
          Differences only
        </button>
        <Link href="/listings" className="av-label ml-auto text-ink-muted hover:text-ink">
          Change the set
        </Link>
      </div>

      <div className="overflow-x-auto rounded-sm border border-rule">
        <table className="w-full min-w-[640px] border-collapse bg-paper-raised text-[13.5px]">
          <caption className="sr-only">Property comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[168px] bg-paper-sunken p-[14px] text-left align-bottom">
                <span className="sr-only">Attribute</span>
              </th>
              {items.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className="min-w-[180px] border-l border-rule bg-paper-sunken p-[14px] text-left align-bottom"
                >
                  <Plate ratio="thumb" className="mb-2 rounded-sm">
                    {p.images[0] ? (
                      <Image src={p.images[0]} alt="" fill sizes="180px" className="object-cover" />
                    ) : null}
                  </Plate>
                  <span className="av-display block text-[19px] leading-tight">{p.title}</span>
                  <span className="mt-1 block text-[12.5px] font-normal text-ink-muted">
                    {p.city}
                  </span>
                  <span className="mt-2 block">
                    <Status tone={p.status === "ACTIVE" ? "ready" : "pending"}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Status>
                  </span>
                  <Link
                    href={`/property/${p.id}`}
                    className="av-label mt-2 inline-block border-b border-rule-firm pb-[3px] text-ink hover:border-burgundy hover:text-burgundy"
                  >
                    Open
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const rows = diffOnly
                ? g.rows.filter((r) => new Set(r.values.map((v) => v ?? "—")).size > 1)
                : g.rows;
              if (rows.length === 0) return null;
              return (
                <Fragment key={g.group}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={cols + 1}
                      className="av-label border-y border-rule bg-paper-sunken px-[14px] py-[10px] text-left text-ink-muted"
                    >
                      {g.group}
                    </th>
                  </tr>
                  {rows.map((r) => (
                    <tr key={`${g.group}-${r.label}`}>
                      <th
                        scope="row"
                        className="border-b border-rule p-[14px] text-left font-medium text-ink-muted"
                      >
                        {r.label}
                      </th>
                      {r.values.map((v, i) => (
                        <td
                          key={i}
                          className={cn(
                            "av-num border-b border-l border-rule p-[14px] align-top",
                            v === null && "text-ink-disabled",
                            r.best?.includes(i) && "font-semibold text-positive",
                          )}
                        >
                          {v ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-[var(--s-3)] max-w-[66ch] text-[12.5px] leading-relaxed text-ink-muted">
        Green marks the better value on that row alone — a lower price, or more area. It is not a
        score, not a recommendation and not advice. A field the developer has not filed reads “—”
        rather than an estimate.
      </p>

      <div className="mt-[var(--s-6)] flex flex-wrap gap-[var(--s-3)]">
        <Link
          href="/contact"
          className="av-label rounded-xs bg-burgundy px-5 py-3 text-paper transition-colors hover:bg-burgundy-deep"
        >
          Enquire on these
        </Link>
      </div>
    </>
  );
}
