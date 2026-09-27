/**
 * The reconstruction coverage gate.
 *
 * This is what stands between a user and being charged for a job that could
 * never have produced geometry. The cases below are written from the physics:
 * structure-from-motion recovers depth from parallax, so material where the
 * camera never moved around the subject must be refused however good it looks.
 *
 * The REEF case at the bottom is a real regression: those numbers were measured
 * from the supplied marketing films, and the gate must keep rejecting them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessCoverage,
  COVERAGE_THRESHOLDS,
  type CoverageStats,
} from "../src/lib/media/reconstruction.ts";

/** A capture that should pass: a slow continuous walk around a building. */
const good = (o: Partial<CoverageStats> = {}): CoverageStats => ({
  frameCount: 180,
  minEdgePx: 1080,
  shotCount: 1,
  durationSeconds: 60,
  meanBaselineDegrees: 2.0,
  blurredFraction: 0.05,
  duplicateFraction: 0.1,
  ...o,
});

test("a continuous orbit with sharp frames passes", () => {
  assert.equal(assessCoverage(good()).sufficient, true);
});

test("too few viewpoints is refused", () => {
  const v = assessCoverage(good({ frameCount: COVERAGE_THRESHOLDS.minFrames - 1 }));
  assert.equal(v.sufficient, false);
  assert.ok(v.sufficient === false && v.problems.includes("TOO_FEW_FRAMES"));
});

test("low resolution is refused", () => {
  const v = assessCoverage(good({ minEdgePx: 480 }));
  assert.equal(v.sufficient, false);
  assert.ok(v.sufficient === false && v.problems.includes("RESOLUTION_TOO_LOW"));
});

test("a locked-off camera is refused — no parallax means no depth", () => {
  const v = assessCoverage(good({ meanBaselineDegrees: 0 }));
  assert.equal(v.sufficient, false);
  assert.ok(v.sufficient === false && v.problems.includes("NO_PARALLAX"));
});

test("a pure push-in is refused: moving towards a subject is not moving around it", () => {
  const v = assessCoverage(good({ meanBaselineDegrees: 0.2 }));
  assert.equal(v.sufficient, false);
  assert.ok(v.sufficient === false && v.problems.includes("NO_PARALLAX"));
});

test("heavily cut footage is refused", () => {
  // 48 cuts across 109 seconds — edited marketing, not a capture.
  const v = assessCoverage(good({ shotCount: 48, durationSeconds: 109 }));
  assert.equal(v.sufficient, false);
  assert.ok(v.sufficient === false && v.problems.includes("TOO_MANY_CUTS"));
});

test("a photo set is not penalised for having no duration", () => {
  const v = assessCoverage(good({ durationSeconds: null, shotCount: 200 }));
  assert.equal(v.sufficient, true);
});

test("mostly blurred frames are refused", () => {
  const v = assessCoverage(good({ blurredFraction: 0.8 }));
  assert.ok(v.sufficient === false && v.problems.includes("TOO_BLURRED"));
});

test("near-duplicate frames are refused", () => {
  const v = assessCoverage(good({ duplicateFraction: 0.95 }));
  assert.ok(v.sufficient === false && v.problems.includes("TOO_MANY_DUPLICATES"));
});

test("every refusal explains what to do differently", () => {
  const v = assessCoverage({
    frameCount: 4,
    minEdgePx: 240,
    shotCount: 40,
    durationSeconds: 60,
    meanBaselineDegrees: 0,
    blurredFraction: 0.9,
    duplicateFraction: 0.9,
  });
  assert.equal(v.sufficient, false);
  if (v.sufficient === false) {
    assert.equal(v.guidance.length, v.problems.length);
    for (const g of v.guidance) assert.ok(g.length > 20, "guidance must be actionable prose");
  }
});

test("REGRESSION: the supplied REEF marketing footage is refused", () => {
  /* Measured from REEF 996 - Walkthrough Video (Vertical).mp4: 48 shots across
     109s, and the longest continuous shot is a static hold with a slight
     push-in, so the angular baseline is effectively zero. If this ever passes,
     the gate has stopped doing its job. */
  const reef: CoverageStats = {
    frameCount: 2725,
    minEdgePx: 1296,
    shotCount: 48,
    durationSeconds: 109,
    meanBaselineDegrees: 0.1,
    blurredFraction: 0.1,
    duplicateFraction: 0.7,
  };
  const v = assessCoverage(reef);
  assert.equal(v.sufficient, false, "REEF marketing footage must never be accepted for reconstruction");
  assert.ok(v.sufficient === false && v.problems.includes("NO_PARALLAX"));
  assert.ok(v.sufficient === false && v.problems.includes("TOO_MANY_CUTS"));
});
