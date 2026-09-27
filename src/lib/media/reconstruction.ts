/**
 * Reconstruction: turning photographs or video into 3D.
 *
 * Two things live here, and neither pretends.
 *
 * 1. A coverage gate. Structure-from-motion can only recover depth when the
 *    camera has moved *around* the subject: parallax is what makes
 *    triangulation possible. Material without it cannot produce geometry, no
 *    matter how good the engine. Checking first means a user is told what to
 *    re-shoot instead of being charged for a job that was never going to work.
 *
 *    The thresholds below are not guesses. They come from measuring the REEF
 *    996 marketing films, which fail this gate: 48 cuts in 109 seconds, and the
 *    longest continuous shot is a static hold with a slight push-in — near-zero
 *    angular baseline. That is exactly the shape of input that must be refused.
 *
 * 2. A processor interface. No reconstruction engine is bundled: photogrammetry
 *    needs COLMAP/OpenMVS or a hosted service, neither of which is configured.
 *    getReconstructionProcessor() therefore returns null, and callers report
 *    PROCESSOR_NOT_CONFIGURED rather than inventing a job id for work that will
 *    never run. Swapping in a real engine means implementing this interface —
 *    no UI, entitlement, property-page or viewer code changes.
 */

/** Measurements a worker takes from submitted media before any reconstruction. */
export type CoverageStats = {
  /** Usable frames or photographs supplied. */
  readonly frameCount: number;
  /** Shortest edge in pixels across the set. */
  readonly minEdgePx: number;
  /** Hard cuts detected. A cut breaks feature continuity between viewpoints. */
  readonly shotCount: number;
  /** Seconds of footage, or null for a photo set. */
  readonly durationSeconds: number | null;
  /**
   * Mean angular change between consecutive viewpoints, in degrees. This is the
   * parallax signal: a static or purely forward-moving camera reads near zero
   * and cannot support triangulation.
   */
  readonly meanBaselineDegrees: number;
  /** Fraction of frames rejected as too blurred to match, 0–1. */
  readonly blurredFraction: number;
  /** Fraction that duplicate an existing viewpoint, 0–1. */
  readonly duplicateFraction: number;
};

export const COVERAGE_THRESHOLDS = {
  /** Below this there are too few viewpoints to solve a camera pose graph. */
  minFrames: 40,
  /** Feature matching degrades badly below roughly 720p on a short edge. */
  minEdgePx: 720,
  /** Mean baseline under this is effectively a locked-off or push-in camera. */
  minBaselineDegrees: 1.5,
  /** More cuts than this and the set is edited marketing, not a capture. */
  maxShotsPerMinute: 6,
  maxBlurredFraction: 0.35,
  maxDuplicateFraction: 0.6,
} as const;

export type CoverageProblem =
  | "TOO_FEW_FRAMES"
  | "RESOLUTION_TOO_LOW"
  | "NO_PARALLAX"
  | "TOO_MANY_CUTS"
  | "TOO_BLURRED"
  | "TOO_MANY_DUPLICATES";

/** What the user should actually do differently. Shown verbatim. */
export const COVERAGE_GUIDANCE: Readonly<Record<CoverageProblem, string>> = {
  TOO_FEW_FRAMES:
    "Add more viewpoints. Walk right around the property, keeping the building in shot the whole way.",
  RESOLUTION_TOO_LOW:
    "Capture at a higher resolution — at least 720p on the shortest edge, and more if you can.",
  NO_PARALLAX:
    "The camera barely moved around the subject. Walking towards it is not enough: move around it in an arc so each shot sees the building from a genuinely different angle.",
  TOO_MANY_CUTS:
    "This looks like edited footage. Reconstruction needs one continuous take, because each cut breaks the link between viewpoints.",
  TOO_BLURRED: "Too many frames are blurred. Move slowly and steadily, and keep the shot sharp.",
  TOO_MANY_DUPLICATES:
    "Most frames show the same viewpoint. Keep moving while recording so each frame adds something new.",
};

export type CoverageVerdict =
  | { readonly sufficient: true }
  | { readonly sufficient: false; readonly problems: CoverageProblem[]; readonly guidance: string[] };

/** Decide whether material can support a reconstruction at all. Pure. */
export function assessCoverage(stats: CoverageStats): CoverageVerdict {
  const problems: CoverageProblem[] = [];

  if (stats.frameCount < COVERAGE_THRESHOLDS.minFrames) problems.push("TOO_FEW_FRAMES");
  if (stats.minEdgePx < COVERAGE_THRESHOLDS.minEdgePx) problems.push("RESOLUTION_TOO_LOW");
  // The decisive one: no angular baseline means no depth, full stop.
  if (stats.meanBaselineDegrees < COVERAGE_THRESHOLDS.minBaselineDegrees) problems.push("NO_PARALLAX");

  if (stats.durationSeconds && stats.durationSeconds > 0) {
    const shotsPerMinute = stats.shotCount / (stats.durationSeconds / 60);
    if (shotsPerMinute > COVERAGE_THRESHOLDS.maxShotsPerMinute) problems.push("TOO_MANY_CUTS");
  }

  if (stats.blurredFraction > COVERAGE_THRESHOLDS.maxBlurredFraction) problems.push("TOO_BLURRED");
  if (stats.duplicateFraction > COVERAGE_THRESHOLDS.maxDuplicateFraction) {
    problems.push("TOO_MANY_DUPLICATES");
  }

  if (problems.length === 0) return { sufficient: true };
  return { sufficient: false, problems, guidance: problems.map((p) => COVERAGE_GUIDANCE[p]) };
}

/* ── Processor interface ───────────────────────────────────────────────── */

export type ReconstructionKind = "MESH" | "SPLAT";

export type ReconstructionRequest = {
  readonly mediaAssetId: string;
  readonly kind: ReconstructionKind;
  readonly sourceKey: string;
};

/** Engine-reported progress. Only ever set from real worker state. */
export type ReconstructionStage =
  | "QUEUED"
  | "ANALYSING"
  | "RECONSTRUCTING"
  | "OPTIMISING"
  | "READY"
  | "FAILED";

export type ReconstructionHandle = {
  readonly jobId: string;
  readonly stage: ReconstructionStage;
};

/**
 * Implemented by a real engine later (COLMAP/OpenMVS locally, or a hosted
 * reconstruction service). Until one exists, nothing implements this.
 */
export interface ReconstructionProcessor {
  readonly engine: string;
  submit(request: ReconstructionRequest): Promise<ReconstructionHandle>;
  status(jobId: string): Promise<ReconstructionHandle>;
}

/**
 * No engine is configured, so this returns null and callers must say so.
 *
 * Returning null rather than a stub is deliberate: a stub that accepted jobs
 * would produce queue entries, progress and eventually a "result" for work that
 * never happened.
 */
export function getReconstructionProcessor(): ReconstructionProcessor | null {
  return null;
}

export const reconstructionAvailable = (): boolean => getReconstructionProcessor() !== null;
