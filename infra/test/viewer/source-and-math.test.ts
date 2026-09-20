import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LoadGate } from "../../../src/lib/viewer/load-gate";
import { directionVector, equirectUv, headingOf, isEquirectangular, maxPanoramaWidth } from "../../../src/lib/viewer/panorama-math";
import { MEDIA_KEY_PATTERN } from "../../../shared/media-contract";
import { PANORAMA_LIMITS, VIEWER_MEDIA_KEY_PATTERN, normalizeView, resolveModelUrl, resolvePanoramaUrl, sourceFromKey, sourceKey } from "../../../src/lib/viewer/source";

const SITE = "https://www.aarvasa.test";
const CDN = "https://cdn.media.test";
const KEY = "m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/panorama.jpg";

describe("viewer source contract: panorama URL policy", () => {
  const allowed = (url: string) => resolvePanoramaUrl(url, SITE, [CDN]);

  it("accepts a published m/ key on the configured CDN, and same-origin images", () => {
    assert.equal(allowed(`${CDN}/${KEY}`), `${CDN}/${KEY}`);
    assert.equal(allowed(`${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/room.webp`), `${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/room.webp`);
    assert.equal(allowed("/labs/panoramas/test-room-a.jpg"), "/labs/panoramas/test-room-a.jpg");
  });

  const refused: [string, string][] = [
    ["external panorama host", `https://panoramas.example.com/${KEY}`],
    ["plain http on the CDN host", `http://cdn.media.test/${KEY}`],
    ["review key (private, pre-publication)", `${CDN}/review/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/panorama.jpg`],
    ["ingest key (private upload)", `${CDN}/uploads/cm1abcd2ef3gh4/u-1/source.jpg`],
    ["private original", `${CDN}/originals/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/source.jpg`],
    ["presigned URL (query string)", `${CDN}/${KEY}?X-Amz-Signature=abc&X-Amz-Credential=AKIA`],
    ["fragment", `${CDN}/${KEY}#x`],
    ["credentials in the URL", `https://user:secret@cdn.media.test/${KEY}`],
    ["path traversal into review/", `${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/../../../review/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/p.jpg`],
    ["encoded traversal", `${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/%2e%2e/%2e%2e/%2e%2e/review/x/y/p.jpg`],
    ["protocol-relative", "//evil.example/pano.jpg"],
    ["backslash host switch", "/\\evil.example/pano.jpg"],
    ["javascript: URL", "javascript:alert(1)//.jpg"],
    ["data: URL", "data:image/jpeg;base64,AAAA"],
    ["SVG (scriptable) extension", `${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/panorama.svg`],
    ["a model is not a panorama", `${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/scene.glb`],
    ["malformed", "http://[::1"],
    ["not a string", 42 as unknown as string],
  ];
  for (const [name, url] of refused) {
    it(`refuses ${name}`, () => assert.equal(allowed(url), null));
  }

  it("uses exactly the storage contract's published-key pattern", () => {
    assert.equal(VIEWER_MEDIA_KEY_PATTERN.source, MEDIA_KEY_PATTERN.source);
    assert.equal(VIEWER_MEDIA_KEY_PATTERN.flags, MEDIA_KEY_PATTERN.flags);
  });

  it("refuses every CDN URL when this build has no CDN origin (production today)", () => {
    assert.equal(resolvePanoramaUrl(`${CDN}/${KEY}`, SITE, []), null);
  });

  it("applies the same m/ key rule to models", () => {
    assert.ok(resolveModelUrl(`${CDN}/m/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/scene.glb`, SITE, [CDN]));
    assert.equal(resolveModelUrl(`${CDN}/review/cm1abcd2ef3gh4/3f9a1c2b7d4e8f60/scene.glb`, SITE, [CDN]), null);
    assert.equal(resolveModelUrl(`${CDN}/${KEY}`, SITE, [CDN]), null);
  });
});

describe("viewer source contract: views and source keys", () => {
  it("normalises yaw to (−180, 180] and clamps pitch and field of view", () => {
    assert.deepEqual(normalizeView({ yawDeg: 190, pitchDeg: 100, fovDeg: 10 }), { yawDeg: -170, pitchDeg: PANORAMA_LIMITS.maxPitchDeg, fovDeg: PANORAMA_LIMITS.minFovDeg });
    assert.deepEqual(normalizeView({ yawDeg: -180, pitchDeg: -100, fovDeg: 500 }), { yawDeg: 180, pitchDeg: PANORAMA_LIMITS.minPitchDeg, fovDeg: PANORAMA_LIMITS.maxFovDeg });
    assert.deepEqual(normalizeView({ yawDeg: 720, pitchDeg: 0, fovDeg: 75 }), { yawDeg: 0, pitchDeg: 0, fovDeg: 75 });
  });

  it("round-trips panorama and model sources through their string keys", () => {
    const pano = { kind: "panorama" as const, url: `${CDN}/${KEY}`, initialView: { yawDeg: -90, pitchDeg: 5.5, fovDeg: 75 } };
    assert.deepEqual(sourceFromKey(sourceKey(pano)), pano);
    const odd = { ...pano, url: "/a|b.jpg" };
    assert.deepEqual(sourceFromKey(sourceKey(odd)), odd);
    const model = { kind: "model" as const, url: "/labs/viewer/sample.glb" };
    assert.deepEqual(sourceFromKey(sourceKey(model)), model);
    assert.equal(sourceKey(undefined), "procedural");
  });

  it("rejects malformed panorama descriptors", () => {
    assert.equal(sourceFromKey("panorama:abc|0|75|/x.jpg"), undefined);
    assert.equal(sourceFromKey("panorama:0|0|75"), undefined);
    assert.equal(sourceFromKey("panorama:0|NaN|75|/x.jpg"), undefined);
    assert.equal(sourceFromKey("splat:/x.sog"), undefined);
  });

  it("changes the key when the room's image or opening view changes, so the viewer reloads", () => {
    const a = sourceKey({ kind: "panorama", url: "/a.jpg", initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 } });
    assert.notEqual(a, sourceKey({ kind: "panorama", url: "/b.jpg", initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 } }));
    assert.notEqual(a, sourceKey({ kind: "panorama", url: "/a.jpg", initialView: { yawDeg: 90, pitchDeg: 0, fovDeg: 75 } }));
  });
});

describe("panorama geometry", () => {
  const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

  it("yaw 0 looks down −Z, positive yaw turns right (+X), positive pitch looks up", () => {
    const f = directionVector(0, 0);
    close(f[0], 0); close(f[1], 0); close(f[2], -1);
    const r = directionVector(90, 0);
    close(r[0], 1); close(r[2], 0);
    close(directionVector(0, 90)[1], 1);
    close(directionVector(0, -90)[1], -1);
  });

  it("headingOf inverts directionVector", () => {
    for (let yaw = -170; yaw <= 180; yaw += 17) {
      for (let pitch = -80; pitch <= 80; pitch += 20) {
        const h = headingOf(directionVector(yaw, pitch));
        close(h.yawDeg, yaw, 1e-7);
        close(h.pitchDeg, pitch, 1e-7);
      }
    }
  });

  it("maps headings to equirectangular texture coordinates with v = 0 at the top row", () => {
    assert.deepEqual(equirectUv(0, 0), [0.5, 0.5]);
    assert.deepEqual(equirectUv(-180, 0), [0, 0.5]);
    assert.deepEqual(equirectUv(180, 0), [1, 0.5]);
    assert.deepEqual(equirectUv(90, 0), [0.75, 0.5]);
    assert.deepEqual(equirectUv(0, 90), [0.5, 0]);
    assert.deepEqual(equirectUv(0, -90), [0.5, 1]);
  });

  it("accepts only 2:1 images and caps texture width per device class", () => {
    assert.equal(isEquirectangular(2048, 1024), true);
    assert.equal(isEquirectangular(8192, 4096), true);
    assert.equal(isEquirectangular(2050, 1024), true);
    assert.equal(isEquirectangular(1920, 1080), false);
    assert.equal(isEquirectangular(1024, 1024), false);
    assert.equal(isEquirectangular(0, 0), false);
    assert.equal(maxPanoramaWidth(16384, false), 8192);
    assert.equal(maxPanoramaWidth(16384, true), 4096);
    assert.equal(maxPanoramaWidth(4096, false), 4096);
  });
});

describe("viewer lifecycle: latest load wins", () => {
  it("aborts and invalidates the previous load when a new room is requested", () => {
    const gate = new LoadGate();
    const first = gate.begin();
    assert.equal(first.isCurrent(), true);
    const second = gate.begin();
    assert.equal(first.signal.aborted, true);
    assert.equal(first.isCurrent(), false);
    assert.equal(second.signal.aborted, false);
    assert.equal(second.isCurrent(), true);
  });

  it("rapid switching leaves only the last request current", () => {
    const gate = new LoadGate();
    const tickets = Array.from({ length: 10 }, () => gate.begin());
    assert.deepEqual(tickets.map((t) => t.isCurrent()), [...Array(9).fill(false), true]);
    assert.equal(tickets.filter((t) => t.signal.aborted).length, 9);
  });

  it("close() (viewer destroyed) aborts the in-flight load and every later one", () => {
    const gate = new LoadGate();
    const inFlight = gate.begin();
    gate.close();
    assert.equal(inFlight.signal.aborted, true);
    assert.equal(inFlight.isCurrent(), false);
    const late = gate.begin();
    assert.equal(late.signal.aborted, true);
    assert.equal(late.isCurrent(), false);
  });
});
