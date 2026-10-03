/**
 * Measuring whether submitted photographs or video could support a 3D
 * reconstruction at all.
 *
 * The client is never trusted for this. A browser can report any frame count it
 * likes, and "I walked around the building" is not something a file knows. So
 * the numbers in CoverageStats are produced here, from the decoded pixels of the
 * material that actually arrived.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * This is not structure-from-motion. It does not solve camera poses, and the
 * baseline it reports is an *estimate* in degrees, not a measured angle between
 * recovered viewpoints — recovering those is the expensive job this gate exists
 * to avoid starting. What it does is cheap and decisive at the only question
 * that matters before spending GPU time: did the camera move *around* the
 * subject, or did it sit still, or push straight in?
 *
 * The distinction is made by block matching on downscaled greyscale frames. The
 * displacement field between two frames is decomposed into:
 *
 *   - translation: the field's median displacement. A camera arcing around a
 *     subject produces a large, consistent one.
 *   - divergence: how much displacement grows with distance from the frame
 *     centre. A dolly straight towards the subject is almost pure divergence —
 *     the image expands outward — and recovers no new geometry, because every
 *     viewpoint sits on the same line through the scene.
 *
 * Parallax is therefore charged for the translational part only, which is what
 * makes a push-in read as near-zero rather than as vigorous movement. The
 * conversion to degrees uses an assumed horizontal field of view, because EXIF
 * focal length is absent from most video and is attacker-supplied where present;
 * the constant is stated below rather than hidden.
 *
 * Pure: no ffmpeg, no filesystem, no decoding. Callers hand it greyscale frames,
 * so every rule here is asserted directly by tests.
 */

import type { CoverageStats } from "./reconstruction";

/** One decoded frame, 8-bit greyscale, row-major, length === width * height. */
export type GreyFrame = {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
};

export const COVERAGE_ANALYSIS = {
  /**
   * Assumed horizontal field of view in degrees, for turning pixel displacement
   * into an angle. 65° is a common phone main-camera value; the gate's own
   * threshold is well clear of the error this introduces, and getting it wrong
   * by 10° does not change a pass into a fail.
   */
  assumedHfovDegrees: 65,
  /** Block size, in pixels of the downscaled frame, for displacement search. */
  blockPx: 16,
  /** Maximum displacement searched, in pixels of the downscaled frame. */
  searchPx: 12,
  /** Laplacian variance below this reads as a blurred frame. */
  blurVarianceThreshold: 60,
  /** Mean absolute frame difference below this reads as a duplicate viewpoint. */
  duplicateMeanAbsDiff: 2.5,
  /**
   * Normalised histogram distance above this reads as a hard cut. Chosen well
   * above what a fast pan produces and well below a genuine scene change.
   */
  cutHistogramDistance: 0.45,
  /**
   * Fraction of the displacement field that must agree in direction for the
   * motion to count as translation rather than noise or a divergent zoom.
   */
  minTranslationAgreement: 0.55,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── Per-frame measures ───────────────────────────────────────────────────── */

/**
 * Variance of the Laplacian: the standard cheap sharpness measure. A sharp frame
 * has strong second derivatives at edges; a blurred one does not.
 */
export function laplacianVariance(frame: GreyFrame): number {
  const { width: w, height: h, pixels: p } = frame;
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * p[i] - p[i - 1] - p[i + 1] - p[i - w] - p[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Mean absolute difference between two frames of equal size, 0–255. */
export function meanAbsDiff(a: GreyFrame, b: GreyFrame): number {
  if (a.width !== b.width || a.height !== b.height) return 255;
  let total = 0;
  for (let i = 0; i < a.pixels.length; i++) total += Math.abs(a.pixels[i] - b.pixels[i]);
  return total / Math.max(a.pixels.length, 1);
}

/** 32-bin intensity histogram, normalised to sum to 1. */
export function histogram(frame: GreyFrame): Float64Array {
  const bins = new Float64Array(32);
  for (const v of frame.pixels) bins[v >> 3]++;
  const total = frame.pixels.length || 1;
  for (let i = 0; i < bins.length; i++) bins[i] /= total;
  return bins;
}

/** Total-variation distance between two normalised histograms, 0–1. */
export function histogramDistance(a: Float64Array, b: Float64Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / 2;
}

/* ── Displacement between a pair of frames ────────────────────────────────── */

export type Displacement = {
  /** Median displacement magnitude attributable to translation, in pixels. */
  readonly translationPx: number;
  /** How much of the field is a centre-outward expansion, 0–1. */
  readonly divergence: number;
  /** Fraction of blocks whose direction agrees with the dominant one, 0–1. */
  readonly agreement: number;
};

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const s = [...values].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
};

/**
 * Block-match `b` against `a` and describe the displacement field.
 *
 * Blocks whose content is flat are skipped: a featureless sky matches equally
 * well everywhere, and letting it vote would wash out the real motion.
 */
export function displacementBetween(a: GreyFrame, b: GreyFrame): Displacement {
  const { blockPx: B, searchPx: S } = COVERAGE_ANALYSIS;
  if (a.width !== b.width || a.height !== b.height || a.width < B + 2 * S || a.height < B + 2 * S) {
    return { translationPx: 0, divergence: 0, agreement: 0 };
  }
  const cx = a.width / 2;
  const cy = a.height / 2;
  const vectors: { x: number; y: number; dx: number; dy: number }[] = [];

  for (let by = S; by + B + S <= a.height; by += B) {
    for (let bx = S; bx + B + S <= a.width; bx += B) {
      // Skip flat blocks: they match everywhere and carry no information.
      let min = 255;
      let max = 0;
      for (let y = 0; y < B; y++) {
        for (let x = 0; x < B; x++) {
          const v = a.pixels[(by + y) * a.width + bx + x];
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      if (max - min < 12) continue;

      let best = Infinity;
      let bestDx = 0;
      let bestDy = 0;
      for (let dy = -S; dy <= S; dy++) {
        for (let dx = -S; dx <= S; dx++) {
          let sad = 0;
          for (let y = 0; y < B; y++) {
            const ra = (by + y) * a.width + bx;
            const rb = (by + y + dy) * b.width + bx + dx;
            for (let x = 0; x < B; x++) sad += Math.abs(a.pixels[ra + x] - b.pixels[rb + x]);
            if (sad >= best) break;
          }
          if (sad < best) {
            best = sad;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }
      vectors.push({ x: bx + B / 2 - cx, y: by + B / 2 - cy, dx: bestDx, dy: bestDy });
    }
  }

  if (vectors.length < 4) return { translationPx: 0, divergence: 0, agreement: 0 };

  // Dominant translation: the component-wise median, which ignores outliers.
  const medDx = median(vectors.map((v) => v.dx));
  const medDy = median(vectors.map((v) => v.dy));
  const translationPx = Math.hypot(medDx, medDy);

  /* Divergence: how strongly displacement points away from (or towards) the
     frame centre once the translation is removed. A dolly in or out is almost
     all divergence, and that is motion along the view axis — new pixels, no new
     viewpoint. */
  let radialSum = 0;
  let magnitudeSum = 0;
  let agree = 0;
  const dominantLength = Math.hypot(medDx, medDy) || 1;
  for (const v of vectors) {
    const rx = v.dx - medDx;
    const ry = v.dy - medDy;
    const radius = Math.hypot(v.x, v.y) || 1;
    radialSum += (rx * v.x + ry * v.y) / radius;
    magnitudeSum += Math.hypot(rx, ry);
    // Direction agreement with the dominant translation.
    if ((v.dx * medDx + v.dy * medDy) / (dominantLength * (Math.hypot(v.dx, v.dy) || 1)) > 0.5) agree++;
  }
  const divergence = magnitudeSum > 0 ? clamp(Math.abs(radialSum) / magnitudeSum, 0, 1) : 0;

  return { translationPx, divergence, agreement: agree / vectors.length };
}

/* ── Whole-set measurement ────────────────────────────────────────────────── */

export type FrameSetInput = {
  /** Downscaled greyscale frames, in capture order. */
  readonly frames: readonly GreyFrame[];
  /** Shortest edge of the ORIGINAL material, before downscaling, in pixels. */
  readonly sourceMinEdgePx: number;
  /** Seconds of footage, or null for a photo set. */
  readonly durationSeconds: number | null;
};

/**
 * Turn decoded frames into the CoverageStats the gate judges.
 *
 * The baseline estimate is the heart of it. For each consecutive pair, the
 * translational displacement is converted to degrees using the assumed field of
 * view, and then scaled down by how divergent the field is: a pure push-in
 * (divergence → 1) contributes nothing, because its viewpoints are collinear.
 */
export function measureCoverage(input: FrameSetInput): CoverageStats {
  const { frames } = input;
  const frameCount = frames.length;
  if (frameCount === 0) {
    return {
      frameCount: 0,
      minEdgePx: input.sourceMinEdgePx,
      shotCount: 0,
      durationSeconds: input.durationSeconds,
      meanBaselineDegrees: 0,
      blurredFraction: 1,
      duplicateFraction: 1,
    };
  }

  let blurred = 0;
  for (const f of frames) {
    if (laplacianVariance(f) < COVERAGE_ANALYSIS.blurVarianceThreshold) blurred++;
  }

  let duplicates = 0;
  let cuts = 0;
  const baselines: number[] = [];
  let previousHistogram = histogram(frames[0]);

  for (let i = 1; i < frameCount; i++) {
    const a = frames[i - 1];
    const b = frames[i];

    const h = histogram(b);
    if (histogramDistance(previousHistogram, h) > COVERAGE_ANALYSIS.cutHistogramDistance) cuts++;
    previousHistogram = h;

    if (meanAbsDiff(a, b) < COVERAGE_ANALYSIS.duplicateMeanAbsDiff) {
      duplicates++;
      baselines.push(0);
      continue;
    }

    const d = displacementBetween(a, b);
    // Noise, not motion: a field that does not agree on a direction.
    if (d.agreement < COVERAGE_ANALYSIS.minTranslationAgreement) {
      baselines.push(0);
      continue;
    }
    const degreesPerPixel = COVERAGE_ANALYSIS.assumedHfovDegrees / Math.max(a.width, 1);
    // Charge only the non-divergent part: a dolly in gains no viewpoint.
    baselines.push(d.translationPx * degreesPerPixel * (1 - d.divergence));
  }

  const pairs = Math.max(baselines.length, 1);
  return {
    frameCount,
    minEdgePx: input.sourceMinEdgePx,
    // A set always has at least one shot; a cut starts the next one.
    shotCount: cuts + 1,
    durationSeconds: input.durationSeconds,
    meanBaselineDegrees: baselines.reduce((a, b) => a + b, 0) / pairs,
    blurredFraction: blurred / frameCount,
    duplicateFraction: duplicates / Math.max(frameCount - 1, 1),
  };
}
