export type CurrencyCode = "INR" | "AED";

// Approximate AED -> INR rate. Deliberately a single named constant: it is an
// indicative conversion for Indian buyers, never the contracted price. Reef
// contracts are denominated in AED, so AED is always shown as the primary figure.
export const AED_TO_INR = 24.2;

/** Format a bare amount in its own currency, e.g. "AED 692,000" or "₹1,45,00,000". */
export function formatCurrency(amount: number, currency: CurrencyCode = "INR"): string {
  if (currency === "AED") {
    return `AED ${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(amount)}`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A listing's price for display: never "₹0" or "₹NaN" when no price is stored. */
export function listingPrice(amount: number | null | undefined, currency: CurrencyCode = "INR"): string {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0
    ? formatCurrency(amount, currency)
    : "On request";
}

/** Compact Indian-style figure: 1,61,00,000 -> "₹1.61 Cr". */
export function formatInrCompact(amount: number): string {
  const crore = 10_000_000;
  const lakh = 100_000;
  if (amount >= crore) return `₹${(amount / crore).toFixed(2)} Cr`;
  if (amount >= lakh) return `₹${(amount / lakh).toFixed(2)} L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * Indicative INR equivalent for an AED amount. Returns null for INR amounts, and
 * for a missing price, so callers can skip rendering a second line.
 */
export function inrEstimate(amount: number, currency: CurrencyCode): string | null {
  // No published price: say nothing rather than print "≈ ₹0".
  if (currency !== "AED" || !(amount > 0)) return null;
  return `≈ ${formatInrCompact(amount * AED_TO_INR)}`;
}

/** Compact primary figure for cards, e.g. "AED 692K" / "AED 2.92M" / "₹4.85 Cr". */
export function formatCompact(amount: number, currency: CurrencyCode = "INR"): string {
  if (currency !== "AED") return formatInrCompact(amount);
  if (amount >= 1_000_000) return `AED ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `AED ${Math.round(amount / 1_000)}K`;
  return `AED ${Math.round(amount)}`;
}

/**
 * The currency a stored Property is quoted in.
 *
 * Property has no currency column; seed-reef.js records the country and notes
 * that "the UI derives AED from this". Listing cards previously formatted every
 * price as INR, which restated AED 679,467 as ₹6,79,467 — a misstatement of a
 * real, purchasable price rather than a styling issue.
 */
export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  return country === "UAE" ? "AED" : "INR";
}
