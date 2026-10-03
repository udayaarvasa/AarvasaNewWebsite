/**
 * The coverage analyser, against frames whose motion is known exactly.
 *
 * The case that matters is the one the REEF material is: a camera moving
 * straight towards the subject. It looks energetic — the whole frame is in
 * motion — and it recovers no geometry, because every viewpoint lies on one line
 * through the scene. An analyser that scored that as movement would wave
 * through exactly the jobs the gate exists to refuse, so it is pinned here
 * against a sideways move of the same pixel magnitude.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COVERAGE_ANALYSIS,
  displacementBetween,
  histogram,
  histogramDistance,
  laplacianVariance,
  meanAbsDiff,
  measureCoverage,
  type GreyFrame,
} from "../src/lib/media/coverage-analysis.ts";
import {
  RECONSTRUCTION_DEFAULTS,
  RECONSTRUCTION_WORKER_CONTRACT,
  assessCoverage,
  getReconstructionProcessor,
  reconstructionAvailability,
  type ReconstructionResult,
  type ReconstructionState,
} from "../src/lib/media/reconstruction.ts";
import { isPubliclyShowable, provenanceAllowedFor } from "../src/lib/media/provenance.ts";

const W = 192;
const H = 108;

/** Deterministic high-frequency texture, so block matching has something to match. */
const texture = (x: number, y: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * 255);
};

/** A frame of that texture, sampled through a camera at (ox, oy) with zoom `z`. */
function render(ox: number, oy: number, z = 1): GreyFrame {
  const pixels = new Uint8Array(W * H);
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.round((x - cx) / z + cx + ox);
      const sy = Math.round((y - cy) / z + cy + oy);
      pixels[y * W + x] = texture(sx, sy);
    }
  }
  return { width: W, height: H, pixels };
}

const flat = (value: number): GreyFrame => ({
  width: W,
  height: H,
  pixels: new Uint8Array(W * H).fill(value),
});

const setOf = (frames: GreyFrame[], durationSeconds: number | null = 10) =>
  measureCoverage({ frames, sourceMinEdgePx: 1920, durationSeconds });

/* ── per-frame measures ───────────────────────────────────────────────────── */

test("a flat frame has no high-frequency detail; a textured one does", () => {
  assert.equal(laplacianVariance(flat(128)), 0);
  assert.ok(laplacianVariance(render(0, 0)) > COVERAGE_ANALYSIS.blurVarianceThreshold);
});

test("identical frames differ by nothing", () => {
  assert.equal(meanAbsDiff(render(0, 0), render(0, 0)), 0);
  assert.ok(meanAbsDiff(render(0, 0), render(40, 0)) > COVERAGE_ANALYSIS.duplicateMeanAbsDiff);
});

test("a histogram distance separates a brightness change from a pan", () => {
  assert.equal(histogramDistance(histogram(flat(100)), histogram(flat(100))), 0);
  // Two disjoint flat frames share no bins at all.
  assert.equal(histogramDistance(histogram(flat(10)), histogram(flat(240))), 1);
  // The same texture seen from a different position keeps its distribution.
  assert.ok(histogramDistance(histogram(render(0, 0)), histogram(render(30, 0))) < 0.2);
});

/* ── the decisive one ─────────────────────────────────────────────────────── */

test("a sideways move registers as translation, a push-in does not", () => {
  const sideways = displacementBetween(render(0, 0), render(6, 0));
  assert.ok(sideways.translationPx > 3, `translation ${sideways.translationPx}`);
  assert.ok(sideways.divergence < 0.5, `divergence ${sideways.divergence}`);

  // A zoom of comparable pixel magnitude: the frame expands outward instead.
  const pushIn = displacementBetween(render(0, 0), render(0, 0, 1.12));
  assert.ok(pushIn.divergence > sideways.divergence, "a push-in must read as more divergent than a pan");
});

test("a locked-off camera is refused — no parallax means no depth", () => {
  const frames = Array.from({ length: 60 }, () => render(0, 0));
  const stats = setOf(frames);
  assert.ok(stats.meanBaselineDegrees < 0.1, `baseline ${stats.meanBaselineDegrees}`);
  const verdict = assessCoverage(stats);
  assert.equal(verdict.sufficient, false);
  assert.ok(!verdict.sufficient && verdict.problems.includes("NO_PARALLAX"));
});

test("a pure push-in scores far below the same movement taken sideways", () => {
  const zoom = Array.from({ length: 60 }, (_, i) => render(0, 0, 1 + i * 0.01));
  const arc = Array.from({ length: 60 }, (_, i) => render(i * 6, 0));
  const zoomBaseline = setOf(zoom).meanBaselineDegrees;
  const arcBaseline = setOf(arc).meanBaselineDegrees;
  assert.ok(arcBaseline > zoomBaseline * 2, `arc ${arcBaseline} vs push-in ${zoomBaseline}`);
});

test("an arc around a subject passes the gate", () => {
  const frames = Array.from({ length: 60 }, (_, i) => render(i * 6, 0));
  const stats = setOf(frames);
  assert.ok(stats.meanBaselineDegrees >= 1.5, `baseline ${stats.meanBaselineDegrees}`);
  assert.equal(assessCoverage(stats).sufficient, true);
});

/* ── set-level measures ───────────────────────────────────────────────────── */

test("repeated identical frames are counted as duplicates, not as viewpoints", () => {
  const stats = setOf(Array.from({ length: 50 }, () => render(0, 0)));
  assert.ok(stats.duplicateFraction > 0.9, `duplicates ${stats.duplicateFraction}`);
  assert.ok(!assessCoverage(stats).sufficient);
});

test("blurred material is measured, not assumed", () => {
  const sharp = setOf(Array.from({ length: 50 }, (_, i) => render(i * 6, 0)));
  assert.ok(sharp.blurredFraction < 0.1, `sharp ${sharp.blurredFraction}`);
  const blurry = setOf(Array.from({ length: 50 }, () => flat(128)));
  assert.equal(blurry.blurredFraction, 1);
});

test("a hard cut starts a new shot; smooth movement does not", () => {
  const smooth = Array.from({ length: 40 }, (_, i) => render(i * 4, 0));
  assert.equal(setOf(smooth).shotCount, 1);

  // Alternating between two unrelated images: every pair is a cut.
  const cuts = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? flat(20) : flat(230)));
  assert.equal(setOf(cuts, 10).shotCount, 10);
});

test("an empty set is refused rather than treated as perfect", () => {
  const stats = measureCoverage({ frames: [], sourceMinEdgePx: 1920, durationSeconds: 10 });
  assert.equal(stats.frameCount, 0);
  assert.equal(stats.blurredFraction, 1);
  assert.equal(assessCoverage(stats).sufficient, false);
});

test("a photo set is not penalised for having no duration", () => {
  const stats = setOf(Array.from({ length: 60 }, (_, i) => render(i * 6, 0)), null);
  assert.equal(stats.durationSeconds, null);
  assert.equal(assessCoverage(stats).sufficient, true);
});

/* ── The processor contract ───────────────────────────────────────────────── */

test("every state a caller can be in is expressible, including the two that are not jobs", () => {
  // PROCESSOR_NOT_CONFIGURED and INSUFFICIENT_COVERAGE describe work that was
  // never started, for opposite reasons. Reporting either as QUEUED or FAILED
  // would describe a job that does not exist.
  const states: ReconstructionState[] = [
    "PROCESSOR_NOT_CONFIGURED",
    "PROCESSOR_AVAILABLE",
    "INSUFFICIENT_COVERAGE",
    "QUEUED",
    "ANALYSING",
    "RECONSTRUCTING",
    "OPTIMISING",
    "READY",
    "FAILED",
  ];
  assert.equal(new Set(states).size, states.length);
});

test("no engine is configured, and that is reported as a gap rather than a failure", () => {
  assert.equal(getReconstructionProcessor(), null);
  const availability = reconstructionAvailability();
  assert.equal(availability.state, "PROCESSOR_NOT_CONFIGURED");
  // The reason names what is missing, so the gap is actionable rather than mysterious.
  assert.match(availability.state === "PROCESSOR_NOT_CONFIGURED" ? availability.reason : "", /GPU/i);
});

test("cost limits are fixed by the deployment, not asked for by the caller", () => {
  assert.ok(RECONSTRUCTION_DEFAULTS.timeoutSeconds > 0 && RECONSTRUCTION_DEFAULTS.timeoutSeconds <= 4 * 3600);
  assert.ok(RECONSTRUCTION_DEFAULTS.maxSourceBytes > 0);
  assert.ok((RECONSTRUCTION_DEFAULTS.sampleFps ?? 0) > 0);
});

test("the worker contract measures before it submits, and verifies before it records", () => {
  const steps = RECONSTRUCTION_WORKER_CONTRACT.join("\n");
  const order = (needle: RegExp) => RECONSTRUCTION_WORKER_CONTRACT.findIndex((s) => needle.test(s));
  // Measuring after submitting would mean paying for GPU time on material that
  // cannot produce geometry.
  assert.ok(order(/measure\(\)/) < order(/submit\(\)/), steps);
  // Recording before verifying would let a truncated download become a model.
  assert.ok(order(/verify the SHA-256/) < order(/Write the output/), steps);
  // The client's numbers are never the basis of the decision.
  assert.match(steps, /client's numbers are advisory/i);
  // Reconstruction hands over to review; it never publishes.
  assert.match(steps, /never publishes/i);
});

test("a reconstruction can only ever claim to be a reconstruction", () => {
  // The result type admits one provenance. An engine cannot describe its output
  // as an official developer model even by mistake.
  const result: Pick<ReconstructionResult, "provenance"> = { provenance: "AARVASA_RECONSTRUCTION" };
  assert.equal(result.provenance, "AARVASA_RECONSTRUCTION");
  assert.equal(provenanceAllowedFor("MODEL", "AARVASA_RECONSTRUCTION"), true);
  assert.equal(isPubliclyShowable("AARVASA_RECONSTRUCTION"), true);
});
