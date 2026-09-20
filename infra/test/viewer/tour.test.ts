import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { navigate, sanitizeTour, sceneSource, TOUR_LIMITS, tourFloors, type PanoramaTour } from "../../../src/lib/viewer/tour";

const CDN = "https://cdn.media.test";
const img = (n: string) => `${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/${n}.jpg`;
const scene = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Room ${id}`, alt: `Room ${id} panorama`, imageUrl: img(id), hotspots: [], ...extra });
const go = (id: string, target: string, extra: Record<string, unknown> = {}) => ({ id, label: `Go to ${target}`, yawDeg: 90, pitchDeg: -10, type: "navigation", targetSceneId: target, ...extra });

const sanitize = (input: unknown) => sanitizeTour(input, [CDN]);

describe("tour data contract", () => {
  it("keeps a valid tour and only its public fields", () => {
    const { tour, problems } = sanitize({
      label: "Show flat",
      startSceneId: "living",
      placeholder: false,
      internalNote: "x",
      scenes: [
        scene("living", {
          floor: "Ground",
          sourceKey: "uploads/cm1abcd2ef3gh4/u/source.jpg",
          reviewKey: "review/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/living.jpg",
          initialView: { yawDeg: 45, pitchDeg: 0, fovDeg: 70 },
          hotspots: [go("to-bed", "bed", { presignedUrl: "https://s3/x?X-Amz-Signature=1" })],
        }),
        scene("bed", { floor: "First", hotspots: [{ id: "window", label: "Window", yawDeg: 10, pitchDeg: 5, type: "info", description: "South-facing." }] }),
      ],
    });
    assert.deepEqual(problems, []);
    assert.ok(tour);
    const json = JSON.stringify(tour);
    for (const secret of ["sourceKey", "reviewKey", "uploads/", "review/", "presigned", "X-Amz", "internalNote"]) assert.ok(!json.includes(secret), secret);
    assert.deepEqual(Object.keys(tour.scenes[0]).sort(), ["alt", "floor", "hotspots", "id", "imageUrl", "initialView", "title"]);
    assert.deepEqual(tour.scenes[0].hotspots[0], { id: "to-bed", label: "Go to bed", yawDeg: 90, pitchDeg: -10, type: "navigation", targetSceneId: "bed" });
    assert.deepEqual(tour.scenes[0].initialView, { yawDeg: 45, pitchDeg: 0, fovDeg: 70 });
  });

  it("rejects input that is not a tour", () => {
    for (const bad of [null, "tour", [], { scenes: "x" }, { scenes: [] }]) assert.equal(sanitize(bad).tour, null);
  });

  it("drops scenes with private, external or malformed images, and the hotspots leading to them", () => {
    const { tour, problems } = sanitize({
      label: "T",
      startSceneId: "a",
      scenes: [
        scene("a", { hotspots: [go("to-b", "b"), go("to-c", "c"), go("to-d", "d"), go("to-e", "e")] }),
        scene("b", { imageUrl: `${CDN}/review/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/b.jpg` }),
        scene("c", { imageUrl: "https://panoramas.example.com/c.jpg" }),
        scene("d", { imageUrl: `${CDN}/uploads/cm1abcd2ef3gh4/u/source.jpg` }),
        scene("e", { imageUrl: `${img("e")}?X-Amz-Signature=1` }),
      ],
    });
    assert.deepEqual(tour?.scenes.map((s) => s.id), ["a"]);
    assert.deepEqual(tour?.scenes[0].hotspots, []);
    assert.equal(problems.filter((p) => p.includes("image URL is not allowed")).length, 4);
    assert.equal(problems.filter((p) => p.includes("navigation target does not exist")).length, 4);
  });

  it("validates ids, text and angles", () => {
    const { tour } = sanitize({
      label: "T",
      startSceneId: "a",
      scenes: [
        scene("a", {
          hotspots: [
            go("ok", "b", { yawDeg: 270 }),
            go("ok", "b"), // duplicate id
            go("Bad Id", "b"),
            go("self", "a"),
            go("steep", "b", { pitchDeg: 91 }),
            go("nan", "b", { yawDeg: Number.NaN }),
            go("nolabel", "b", { label: "   " }),
            go("long", "b", { label: "x".repeat(TOUR_LIMITS.maxLabelLength + 1) }),
            { id: "note", label: "Note", yawDeg: 0, pitchDeg: 0, type: "info" }, // info needs a description
            { id: "kind", label: "Kind", yawDeg: 0, pitchDeg: 0, type: "teleport", targetSceneId: "b" },
          ],
        }),
        scene("b"),
        scene("b"), // duplicate scene id
        scene("../x"),
        { id: "c", title: "C", imageUrl: img("c") }, // no alt text
      ],
    });
    assert.deepEqual(tour?.scenes.map((s) => s.id), ["a", "b"]);
    assert.deepEqual(tour?.scenes[0].hotspots.map((h) => [h.id, h.yawDeg]), [["ok", -90]]);
  });

  it("caps scenes and hotspots", () => {
    const hotspots = Array.from({ length: TOUR_LIMITS.maxHotspotsPerScene + 5 }, (_, i) => go(`h${i}`, "b"));
    const scenes = [scene("a", { hotspots }), ...Array.from({ length: TOUR_LIMITS.maxScenes + 5 }, (_, i) => scene(i === 0 ? "b" : `s${i}`))];
    const { tour } = sanitize({ label: "T", startSceneId: "a", scenes });
    assert.equal(tour?.scenes.length, TOUR_LIMITS.maxScenes);
    assert.equal(tour?.scenes[0].hotspots.length, TOUR_LIMITS.maxHotspotsPerScene);
  });

  it("falls back to the first scene when the start scene is missing, and defaults the view", () => {
    const { tour, problems } = sanitize({ label: "T", startSceneId: "gone", scenes: [scene("a", { initialView: { yawDeg: "x" } }), scene("b")] });
    assert.equal(tour?.startSceneId, "a");
    assert.deepEqual(tour?.scenes[0].initialView, { yawDeg: 0, pitchDeg: 0, fovDeg: 75 });
    assert.ok(problems.some((p) => p.includes("start scene")));
  });
});

describe("tour navigation", () => {
  const { tour } = sanitize({
    label: "T",
    startSceneId: "a",
    scenes: [scene("a", { floor: "Ground", hotspots: [go("to-b", "b")] }), scene("b", { floor: "First" }), scene("c", { floor: "Ground" })],
  });
  const t = tour as PanoramaTour;

  it("moves to an existing scene", () => {
    const r = navigate(t, "a", "b");
    assert.ok(r.ok && r.scene.id === "b");
  });

  it("handles missing targets and same-scene requests without throwing", () => {
    assert.deepEqual(navigate(t, "a", "nowhere"), { ok: false, reason: "missing-target" });
    assert.deepEqual(navigate(t, "a", undefined), { ok: false, reason: "missing-target" });
    assert.deepEqual(navigate(t, "a", "a"), { ok: false, reason: "same-scene" });
  });

  it("lists floors in first-appearance order, or none", () => {
    assert.deepEqual(tourFloors(t), ["Ground", "First"]);
    const flat = sanitize({ label: "T", startSceneId: "a", scenes: [scene("a"), scene("b")] }).tour as PanoramaTour;
    assert.deepEqual(tourFloors(flat), []);
  });

  it("gives each scene a panorama viewer source", () => {
    assert.deepEqual(sceneSource(t.scenes[1]), { kind: "panorama", url: img("b"), initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 } });
  });
});
