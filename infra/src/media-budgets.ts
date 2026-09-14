/**
 * Phase 2A starting budgets. One source of truth for the local pipeline, its
 * tests and the runbook. These are review thresholds to validate on real devices
 * in Phase 3, not measured device limits.
 *
 * Units: MB means decimal megabytes (1 MB = 1,000,000 bytes), the stricter reading.
 *
 * Source ceilings for uploadable kinds come from shared/media-asset.ts, which the
 * application's upload intents also enforce, so the two can never disagree.
 */
import { SOURCE_MAX_BYTES } from "../../shared/media-asset";

export const MB = 1_000_000;

export type MediaKind = "MODEL" | "PANORAMA" | "SPLAT" | "TEXTURE";

export interface ByteBudget {
  /** Above this: WARN, exceeds the mobile target. */
  readonly mobileTarget: number;
  /** Above this: WARN, exceeds the desktop target. */
  readonly desktopTarget: number;
  /** Above this: FAIL, cannot be published. */
  readonly hardLimit: number;
  /** Above this: FAIL without reading the file. */
  readonly sourceMax: number;
}

export const BYTE_BUDGETS: Readonly<Record<"MODEL" | "PANORAMA" | "SPLAT" | "POSTER", ByteBudget>> = {
  MODEL: { mobileTarget: 10 * MB, desktopTarget: 25 * MB, hardLimit: 50 * MB, sourceMax: SOURCE_MAX_BYTES.MODEL },
  PANORAMA: { mobileTarget: 2.5 * MB, desktopTarget: 8 * MB, hardLimit: 12 * MB, sourceMax: SOURCE_MAX_BYTES.PANORAMA },
  // A .sog bundle is already the delivery format (no conversion offline), so its
  // source ceiling is the single-file hard limit. PLY sources are out of scope here.
  SPLAT: { mobileTarget: 20 * MB, desktopTarget: 50 * MB, hardLimit: 80 * MB, sourceMax: SOURCE_MAX_BYTES.SPLAT },
  POSTER: { mobileTarget: 0.2 * MB, desktopTarget: 0.2 * MB, hardLimit: 0.5 * MB, sourceMax: 10 * MB },
};

export const SPLAT_GAUSSIAN_BUDGET = { mobileTarget: 1_000_000, desktopTarget: 3_000_000 } as const;
export const MODEL_TRIANGLE_BUDGET = { mobileTarget: 150_000, desktopTarget: 500_000 } as const;
export const TEXTURE_DIMENSION_BUDGET = { mobileTarget: 2048, desktopTarget: 4096 } as const;

/** Equirectangular panoramas are exactly 2:1. */
export const PANORAMA_DIMENSIONS = {
  minWidth: 2048,
  mobileWidth: 4096,
  /** Wider than this needs tiled/multi-resolution delivery, which is not supported yet. */
  maxWidth: 8192,
} as const;

export const SET_BUDGETS = {
  /** Posters plus the largest single entry: what a listing loads before interaction completes. */
  initialViewTarget: 25 * MB,
  /** Above this, the set is flagged as requiring explicit review. */
  publishedTotalReview: 400 * MB,
} as const;

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes >= 10 * MB ? 1 : 2)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${bytes} B`;
}
