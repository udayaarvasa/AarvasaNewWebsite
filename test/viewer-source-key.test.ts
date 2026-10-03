/**
 * The viewer source survives its own serialisation.
 *
 * The React component does not hand the engine the source object. It turns it
 * into a string key, so a new-but-equal descriptor does not restart a load, and
 * rebuilds the source from that key on the other side. Anything the key does not
 * carry is therefore silently dropped between the caller and the engine — which
 * is exactly what happened to a model's opening camera: the framing simply never
 * applied, with no error anywhere, and three different values all looked like
 * no-ops.
 *
 * These cases pin the round-trip for every field the model path carries.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { sourceFromKey, sourceKey } from "../src/lib/viewer/source.ts";
import type { ViewerSource } from "../src/lib/viewer/types.ts";

const URL = "/m/abcdef0123456789/0123456789abcdef/scene.glb";
const DESKTOP = { yawDeg: 26, pitchDeg: 16, distanceFactor: 2.15 };
const MOBILE = { yawDeg: 18, pitchDeg: 10, distanceFactor: 2.0 };

const roundTrip = (s: ViewerSource) => sourceFromKey(sourceKey(s));

test("a model with no stated framing keeps the short key and survives unchanged", () => {
  const source: ViewerSource = { kind: "model", url: URL };
  assert.equal(sourceKey(source), `model:${URL}`);
  assert.deepEqual(roundTrip(source), source);
});

test("a model's opening camera survives the round trip", () => {
  const source: ViewerSource = { kind: "model", url: URL, initialView: DESKTOP };
  assert.deepEqual(roundTrip(source), source);
});

test("a model's narrow-viewer camera survives the round trip", () => {
  const source: ViewerSource = {
    kind: "model",
    url: URL,
    initialView: DESKTOP,
    mobileInitialView: MOBILE,
  };
  const back = roundTrip(source);
  assert.deepEqual(back, source);
  // Both must arrive: carrying only one was the bug this test exists for.
  assert.deepEqual(back?.kind === "model" && back.initialView, DESKTOP);
  assert.deepEqual(back?.kind === "model" && back.mobileInitialView, MOBILE);
});

test("a mobile-only framing survives without a desktop one", () => {
  const source: ViewerSource = { kind: "model", url: URL, mobileInitialView: MOBILE };
  assert.deepEqual(roundTrip(source), source);
});

test("two framings of the same file are different sources", () => {
  // The component keys its reload on this string, so if they collided, changing
  // the framing would not re-frame anything.
  const a = sourceKey({ kind: "model", url: URL, initialView: DESKTOP });
  const b = sourceKey({ kind: "model", url: URL, initialView: MOBILE });
  assert.notEqual(a, b);
  assert.notEqual(a, sourceKey({ kind: "model", url: URL }));
});

test("the same descriptor always gives the same key, whatever order it was built in", () => {
  const a: ViewerSource = { kind: "model", url: URL, initialView: DESKTOP, mobileInitialView: MOBILE };
  const b: ViewerSource = { kind: "model", mobileInitialView: MOBILE, initialView: DESKTOP, url: URL };
  assert.equal(sourceKey(a), sourceKey(b));
});

test("a partial or nonsense framing is dropped rather than half-applied", () => {
  // A camera placed from half a triple is worse than the generic framing.
  for (const bad of [
    { yawDeg: 26, pitchDeg: 16 },
    { yawDeg: 26, pitchDeg: 16, distanceFactor: "2.15" },
    { yawDeg: Number.NaN, pitchDeg: 16, distanceFactor: 2.15 },
    null,
    "close",
  ]) {
    const key = `model:${JSON.stringify({ url: URL, initialView: bad })}`;
    const back = sourceFromKey(key);
    assert.equal(back?.kind === "model" && back.initialView, undefined, JSON.stringify(bad));
    assert.equal(back?.kind === "model" && back.url, URL);
  }
});

test("a malformed model key yields nothing rather than a half-built source", () => {
  assert.equal(sourceFromKey("model:{not json"), undefined);
  assert.equal(sourceFromKey(`model:${JSON.stringify({ initialView: DESKTOP })}`), undefined);
});

test("panorama and splat sources are untouched by the model encoding", () => {
  const panorama: ViewerSource = {
    kind: "panorama",
    url: "/labs/panoramas/test-room-a.jpg",
    initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 },
  };
  assert.deepEqual(roundTrip(panorama), panorama);

  const splat: ViewerSource = {
    kind: "splat",
    url: "/labs/splats/test-scene.sog",
    initialView: { yawDeg: 35, pitchDeg: 20, distanceFactor: 1.6 },
    upAxis: "y-up",
    sizeBytes: 1024,
    gaussians: 1000,
  };
  assert.deepEqual(roundTrip(splat), splat);
});
