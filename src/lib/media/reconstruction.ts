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

/**
 * Everything a worker is given. Nothing else: the worker never sees a session,
 * a cookie or an entitlement record, because by the time a job exists those
 * questions have already been answered by the routes that created it. What it
 * does get is the owner's id, so the asset it produces belongs to the person who
 * submitted the source rather than to whoever happens to review it.
 */
export type ReconstructionRequest = {
  /** The MediaAsset this job belongs to. Also the {mediaId} of every key it writes. */
  readonly mediaAssetId: string;
  readonly kind: ReconstructionKind;
  /** The private ingest key of the submitted photographs or video. */
  readonly sourceKey: string;
  /** Subject, carried through so the output lands on the right project or property. */
  readonly subject:
    | { readonly type: "PROJECT"; readonly projectSlug: string }
    | { readonly type: "PROPERTY"; readonly propertyId: string };
  /** The uploader. The produced asset inherits this owner, never the reviewer. */
  readonly ownerId: string;
  readonly config: ReconstructionConfig;
};

/** Knobs a deployment may set. Absent values mean the engine's own default. */
export type ReconstructionConfig = {
  /** Frames per second to sample from video. Higher is slower and rarely better. */
  readonly sampleFps?: number;
  /** Stop and fail rather than run forever. Enforced by the worker, not the client. */
  readonly timeoutSeconds: number;
  /** Refuse a source larger than this before downloading it. */
  readonly maxSourceBytes: number;
  /** Triangle budget for a MESH result, before the existing pipeline's own budget check. */
  readonly targetTriangles?: number;
};

/**
 * Cost control, applied to every job whatever asked for it.
 *
 * These are not suggestions a client can raise. An unbounded GPU endpoint behind
 * an authenticated route is still an unbounded GPU endpoint, and the limit that
 * matters is the one the worker enforces on the bytes it actually downloaded.
 */
export const RECONSTRUCTION_DEFAULTS: ReconstructionConfig = {
  /* Four frames a second. Denser sampling mostly adds near-duplicate viewpoints,
     which cost matching time and contribute no new geometry. */
  sampleFps: 4,
  /* An hour. Long enough for a few hundred frames on one GPU, short enough that
     a wedged job is noticed the same day rather than billed overnight. */
  timeoutSeconds: 3600,
  /** 2 GB of source. Beyond this the capture should be trimmed, not uploaded. */
  maxSourceBytes: 2 * 1024 * 1024 * 1024,
  /** Matches the viewer's mobile triangle budget; the pipeline checks it again. */
  targetTriangles: 300_000,
};

/** Engine-reported progress. Only ever set from real worker state. */
export type ReconstructionStage =
  | "QUEUED"
  | "ANALYSING"
  | "RECONSTRUCTING"
  | "OPTIMISING"
  | "READY"
  | "FAILED";

/**
 * Every state a caller may be in, including the two that are not a job.
 *
 * PROCESSOR_NOT_CONFIGURED and INSUFFICIENT_COVERAGE both describe work that was
 * never started, and for opposite reasons — one is our gap, the other is the
 * material's. Neither may be reported as QUEUED or FAILED: a queued job that
 * does not exist is a lie the UI will keep telling, and a failure implies
 * something was attempted and might succeed on a retry.
 */
export type ReconstructionState =
  | "PROCESSOR_NOT_CONFIGURED"
  | "PROCESSOR_AVAILABLE"
  | "INSUFFICIENT_COVERAGE"
  | ReconstructionStage;

export type ReconstructionHandle = {
  readonly jobId: string;
  readonly stage: ReconstructionStage;
};

/**
 * What a finished job hands back.
 *
 * The worker does not publish, and does not decide what the thing is. It writes
 * one file to the ingest bucket and reports these fields; the existing pipeline
 * then validates, reviews and publishes it exactly as it does a hand-uploaded
 * model, which is why no part of Media Studio, the entitlement service, the
 * property page or the viewer has to know that reconstruction exists.
 */
export type ReconstructionResult = {
  readonly jobId: string;
  readonly kind: ReconstructionKind;
  /** Ingest key of the produced file, which the normal pipeline then processes. */
  readonly outputKey: string;
  /** GLB for a mesh, SOG for a splat. Nothing else is accepted downstream. */
  readonly format: "GLB" | "SOG";
  /** Hex SHA-256 of the produced file, verified before anything is recorded. */
  readonly sha256: string;
  readonly sizeBytes: number;
  /**
   * Always AARVASA_RECONSTRUCTION. A machine-made model of a building is not an
   * official developer asset, and the engine is not entitled to claim it is —
   * the type makes the claim unexpressible rather than merely discouraged.
   */
  readonly provenance: "AARVASA_RECONSTRUCTION";
  /** Recorded on the asset: engine identity, timings, and what was measured. */
  readonly metadata: {
    readonly engine: string;
    readonly durationSeconds: number;
    /** The worker's own measurement, not the client's. */
    readonly coverage: CoverageStats;
    readonly framesUsed: number;
    readonly triangles?: number;
    readonly gaussians?: number;
  };
};

/**
 * Implemented by a real engine later (COLMAP/OpenMVS on a GPU worker, or a
 * hosted reconstruction service). Until one exists, nothing implements this.
 *
 * Deliberately small. Everything above it — upload, entitlement, ownership, the
 * coverage gate, review, publication, the viewer — is already built against
 * MediaAsset and does not change when an engine appears. Plugging one in means
 * implementing these three members and returning it from
 * getReconstructionProcessor; no UI, route, schema or viewer edits.
 */
export interface ReconstructionProcessor {
  /** Engine identity, recorded on the asset, e.g. "colmap-3.11+openmvs-2.3". */
  readonly engine: string;
  /**
   * Measure the submitted material. Called by the WORKER, never by the browser.
   *
   * The client's own measurement is advisory: it exists so someone is told their
   * footage is unusable before a long upload, and it is attacker-controlled, so
   * nothing is decided by it. This runs again on the bytes that actually
   * arrived, and its verdict is the one that counts.
   */
  measure(request: ReconstructionRequest): Promise<CoverageStats>;
  submit(request: ReconstructionRequest): Promise<ReconstructionHandle>;
  status(jobId: string): Promise<ReconstructionHandle>;
  /** The finished artefact, once status reports READY. */
  collect(jobId: string): Promise<ReconstructionResult>;
}

/**
 * The states a caller may report. Separate from ReconstructionStage, which only
 * describes a job that actually exists.
 *
 * PROCESSOR_NOT_CONFIGURED is not a failure and not an error: it is the honest
 * answer that this deployment has no engine. It must never be presented as a
 * job that is queued, nor as one that failed, because both would describe work
 * that was never attempted.
 */
export type ReconstructionAvailability =
  | { readonly state: "PROCESSOR_NOT_CONFIGURED"; readonly reason: string }
  | { readonly state: "PROCESSOR_AVAILABLE"; readonly engine: string };

/**
 * What a worker must do with a job, in order. Written down because the order is
 * the safety property: measuring before submitting is what stops a deployment
 * paying for GPU time on material that cannot produce geometry, and verifying
 * the checksum before recording anything is what stops a truncated download
 * becoming a published model.
 */
export const RECONSTRUCTION_WORKER_CONTRACT = [
  "Claim the asset (PROCESSING) through the existing lifecycle, as the model worker does.",
  "Refuse a source larger than config.maxSourceBytes without downloading it.",
  "measure() the arrived bytes. The client's numbers are advisory and are not read.",
  "assessCoverage(): if insufficient, report INSUFFICIENT_COVERAGE with its guidance and stop. No job is created and nothing is billed.",
  "submit(), then poll status() until READY or FAILED, within config.timeoutSeconds.",
  "collect(), verify the SHA-256 against the downloaded bytes, and reject a mismatch as a failure.",
  "Write the output to the ingest bucket and hand it to the ordinary processing pipeline, with provenance AARVASA_RECONSTRUCTION.",
  "The asset then follows the normal path: PENDING_REVIEW, a reviewer, and publication. Reconstruction never publishes.",
] as const;

/**
 * What a deployment must provide before getReconstructionProcessor can return
 * anything. Stated here so the requirement is a fact in the codebase rather than
 * a conversation, and so the gap is reviewable.
 *
 * The existing processing Lambda cannot host this. It is arm64 Node on a
 * 15-minute ceiling with no GPU and no ffmpeg binary, which rules out both frame
 * decoding at scale and dense reconstruction. The queue, the worker contract and
 * the MediaAsset lifecycle are all reusable; the compute is not.
 */
export const RECONSTRUCTION_INFRASTRUCTURE = {
  /** Dense stereo and splat training are GPU work; CPU-only runs take hours. */
  gpu: "NVIDIA, 16 GB VRAM or more (sparse SfM is CPU-bound; dense MVS and splat training are not)",
  /** Feature matching is memory-hungry well before the GPU is. */
  memory: "32 GB system RAM for a few hundred frames",
  /** A video arrives as one file and becomes thousands of frames. */
  storage: "50 GB scratch per job, separate from the ingest bucket",
  /** Frame decoding is a hard dependency and is not in the Node runtime. */
  binaries: "ffmpeg (frame extraction), COLMAP (SfM), OpenMVS or equivalent (dense mesh)",
  /** Far beyond Lambda's ceiling, so this is a container or batch job. */
  timeout: "up to 4 hours per job; Lambda's 15-minute maximum cannot hold it",
  runtime: "a container on GPU compute (ECS/EC2/Batch, or a hosted reconstruction API)",
  /** What the adapter must hand back for the existing pipeline to take over. */
  output: "a GLB (MESH) or a SOG bundle (SPLAT) written to the ingest bucket, which the existing worker then validates, reviews and publishes unchanged",
} as const;

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

/** The state to report, with the reason when there is nothing to run on. */
export function reconstructionAvailability(): ReconstructionAvailability {
  const processor = getReconstructionProcessor();
  if (processor) return { state: "PROCESSOR_AVAILABLE", engine: processor.engine };
  return {
    state: "PROCESSOR_NOT_CONFIGURED",
    reason: `No reconstruction engine is configured in this deployment. It needs ${RECONSTRUCTION_INFRASTRUCTURE.runtime} with ${RECONSTRUCTION_INFRASTRUCTURE.gpu}.`,
  };
}

export const reconstructionAvailable = (): boolean => getReconstructionProcessor() !== null;
