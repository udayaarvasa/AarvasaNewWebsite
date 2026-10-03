import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import { BYTE_BUDGETS, SPLAT_GAUSSIAN_BUDGET } from "../../src/media-budgets";
import { Findings } from "../../src/pipeline/findings";
import { validateSog } from "../../src/pipeline/sog";
import { zip } from "../pipeline/fixtures";
import type { Project } from "../../../src/lib/project-types";
import { getProject } from "../../../src/lib/projects";
import { sanitizeViewerEvent } from "../../../src/lib/viewer/analytics";
import { immersiveModes } from "../../../src/lib/viewer/immersive-modes";
import { LoadGate } from "../../../src/lib/viewer/load-gate";
import { projectSplatConfig, splatMediaAssetId } from "../../../src/lib/viewer/project-splat";
import { PUBLISHED_SPLAT_SELECT, publishedSplatQuery, toPublishedSplat } from "../../../src/lib/viewer/published-splats";
import { inspectSogBundle, SogBundleError, sogBounds, type SogErrorCode } from "../../../src/lib/viewer/sog-bundle";
import { resolveSplatUrl, sanitizeSplatSource, sourceFromKey, sourceKey, SPLAT_VIEW_LIMITS } from "../../../src/lib/viewer/source";
import { assessSplat, classifyDevice, SPLAT_LIMITS, splatBudgetFor } from "../../../src/lib/viewer/splat-budget";
import { downloadSog, SplatLoadError } from "../../../src/lib/viewer/splat-download";
import { buildTestSog, encodeSog, storedZip, testSceneSplats, type SogTexture } from "../../../src/lib/viewer/splat-fixtures";

const SITE = "https://www.aarvasa.test";
const CDN = "https://cdn.media.test";
const ID = "cmsplat00000001";
const KEY = `m/${ID}/3f9a1c2b7d4e8f60/scene.sog`;
const inflate = async (b: Uint8Array) => new Uint8Array(inflateRawSync(b));
const lossless = async (t: SogTexture) => new Uint8Array(await sharp(Buffer.from(t.rgba), { raw: { width: t.width, height: t.height, channels: 4 } }).webp({ lossless: true }).toBuffer());

// ── Source contract ──────────────────────────────────────────────────────────

describe("splat source contract: URL policy", () => {
  const allowed = (url: string) => resolveSplatUrl(url, SITE, [CDN]);

  it("accepts a published .sog key on the configured CDN, and a same-origin .sog", () => {
    assert.equal(allowed(`${CDN}/${KEY}`), `${CDN}/${KEY}`);
    assert.equal(allowed("/labs/splats/test-scene.sog"), "/labs/splats/test-scene.sog");
  });

  const refused: [string, string][] = [
    ["another host", `https://splats.example.com/${KEY}`],
    ["plain http on the CDN", `http://cdn.media.test/${KEY}`],
    ["review path", `${CDN}/review/${ID}/3f9a1c2b7d4e8f60/scene.sog`],
    ["ingest path", `${CDN}/uploads/${ID}/u-1/source.sog`],
    ["originals path", `${CDN}/originals/${ID}/3f9a1c2b7d4e8f60/source.sog`],
    ["presigned URL", `${CDN}/${KEY}?X-Amz-Signature=abc&X-Amz-Credential=AKIA`],
    ["fragment", `${CDN}/${KEY}#x`],
    ["credentials", `https://u:p@cdn.media.test/${KEY}`],
    ["path traversal", `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/../../../review/${ID}/3f9a1c2b7d4e8f60/scene.sog`],
    ["encoded traversal", `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/%2e%2e/%2e%2e/%2e%2e/uploads/x/y/s.sog`],
    ["protocol-relative", "//evil.example/scene.sog"],
    ["backslash", "/\\evil.example/scene.sog"],
    ["javascript:", "javascript:alert(1)//.sog"],
    ["data:", "data:application/zip;base64,UEsFBg=="],
    ["blob:", "blob:https://www.aarvasa.test/1234-abcd.sog"],
    ["a PLY source", `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/scene.ply`],
    ["a model", `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/scene.glb`],
    ["unbundled meta.json", `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/meta.json`],
    ["malformed", "https://[::1"],
  ];
  for (const [name, url] of refused) it(`refuses ${name}`, () => assert.equal(allowed(url), null));

  it("refuses CDN URLs when the build has no media origin", () => assert.equal(resolveSplatUrl(`${CDN}/${KEY}`, SITE, []), null));
});

describe("splat source contract: descriptor", () => {
  const valid = { kind: "splat", url: `${CDN}/${KEY}`, initialView: { yawDeg: 400, pitchDeg: 120, distanceFactor: 50 }, upAxis: "y-down", sizeBytes: 12_000_000, gaussians: 900_000 };

  it("rebuilds a descriptor with known fields only, normalising the view", () => {
    const s = sanitizeSplatSource({ ...valid, sourceKey: "uploads/x", reviewKey: "review/x", processingError: "boom" });
    assert.deepEqual(s, {
      kind: "splat",
      url: `${CDN}/${KEY}`,
      initialView: { yawDeg: 40, pitchDeg: SPLAT_VIEW_LIMITS.maxPitchDeg, distanceFactor: SPLAT_VIEW_LIMITS.maxDistanceFactor },
      upAxis: "y-down",
      sizeBytes: 12_000_000,
      gaussians: 900_000,
    });
  });

  it("defaults the view and metadata, and rejects malformed descriptors", () => {
    assert.deepEqual(sanitizeSplatSource({ kind: "splat", url: "/labs/splats/test-scene.sog", sizeBytes: -1, gaussians: 1.5 }), {
      kind: "splat",
      url: "/labs/splats/test-scene.sog",
      initialView: SPLAT_VIEW_LIMITS.defaultView,
      upAxis: "y-up",
      sizeBytes: null,
      gaussians: null,
    });
    for (const bad of [null, "x", { kind: "model", url: "/x.sog" }, { kind: "splat" }, { kind: "splat", url: "" }, { kind: "splat", url: "/x.sog", upAxis: "z-up" }]) {
      assert.equal(sanitizeSplatSource(bad), undefined);
    }
  });

  it("round-trips through a stable source key, and rejects malformed keys", () => {
    const s = sanitizeSplatSource(valid)!;
    assert.deepEqual(sourceFromKey(sourceKey(s)), s);
    assert.equal(sourceKey(s), sourceKey({ ...s }));
    for (const bad of ["splat:", "splat:{", "splat:null", 'splat:{"url":42}', 'splat:{"url":"/x.sog","upAxis":"sideways"}']) assert.equal(sourceFromKey(bad), undefined);
  });
});

// ── SOG runtime pre-check ────────────────────────────────────────────────────

const webpStub = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
const codebook = Array.from({ length: 256 }, (_, i) => i / 255);
const metaV2 = (extra: Record<string, unknown> = {}) => ({
  version: 2,
  count: 100,
  means: { mins: [-1, -1, -1], maxs: [1, 1, 1], files: ["means_l.webp", "means_u.webp"] },
  scales: { codebook, files: ["scales.webp"] },
  quats: { files: ["quats.webp"] },
  sh0: { codebook, files: ["sh0.webp"] },
  ...extra,
});
const bundle = (meta: unknown, files = ["means_l.webp", "means_u.webp", "scales.webp", "quats.webp", "sh0.webp"], deflate = true) =>
  zip([{ name: "meta.json", data: new TextEncoder().encode(JSON.stringify(meta)), deflate }, ...files.map((name) => ({ name, data: webpStub }))]);

const rejects = async (bytes: Uint8Array, code: SogErrorCode) =>
  assert.rejects(inspectSogBundle(bytes, inflate), (e: unknown) => e instanceof SogBundleError && e.code === code);

describe("SOG runtime pre-check", () => {
  it("accepts a v2 bundle (stored or deflated meta.json) and reports count and bounds", async () => {
    for (const deflate of [true, false]) {
      const s = await inspectSogBundle(bundle(metaV2(), undefined, deflate), inflate);
      assert.equal(s.version, 2);
      assert.equal(s.gaussians, 100);
      assert.deepEqual(s.bounds.center, [0, 0, 0]);
      assert.ok(Math.abs(s.bounds.radius - Math.sqrt(3) * (Math.E - 1)) < 1e-9);
    }
  });

  it("accepts v1 (count from means.shape)", async () => {
    const v1 = { means: { shape: [42, 3], mins: [0, 0, 0], maxs: [1, 1, 1], files: ["means_l.webp", "means_u.webp"] }, scales: { files: ["scales.webp"] }, quats: { files: ["quats.webp"] }, sh0: { files: ["sh0.webp"] } };
    const s = await inspectSogBundle(bundle(v1), inflate);
    assert.deepEqual([s.version, s.gaussians], [1, 42]);
  });

  it("rejects unsupported versions", async () => {
    await rejects(bundle(metaV2({ version: 3 })), "unsupported-version");
    await rejects(bundle(metaV2({ version: "2" })), "unsupported-version");
  });

  it("rejects a meta.json that points outside the bundle (the engine would fetch it relative to the page)", async () => {
    await rejects(bundle(metaV2({ sh0: { codebook, files: ["https://evil.example/x.webp"] } })), "unsafe-entry");
    await rejects(bundle(metaV2({ sh0: { codebook, files: ["../sh0.webp"] } })), "unsafe-entry");
    await rejects(bundle(metaV2(), ["means_l.webp", "means_u.webp", "scales.webp", "quats.webp"]), "missing-file");
    await rejects(bundle(metaV2({ shN: { codebook, files: ["centroids.webp", "labels.webp"] } })), "missing-file");
  });

  it("rejects malformed, corrupt and non-SOG files", async () => {
    await rejects(new Uint8Array(10), "not-sog");
    await rejects(new TextEncoder().encode("<html>not a zip, but long enough to have an end record…</html>"), "not-sog");
    const good = bundle(metaV2());
    const commented = new Uint8Array([...good.slice(0, -2), 4, 0, 0x41, 0x41, 0x41, 0x41]);
    await rejects(commented, "not-sog");
    await rejects(good.slice(0, good.length - 40), "not-sog");
    const corrupt = good.slice();
    corrupt[corrupt.length - 6] ^= 0xff; // central directory offset
    await rejects(corrupt, "corrupt");
    await rejects(zip([{ name: "meta.json", data: new TextEncoder().encode("{not json"), deflate: false }]), "invalid-meta");
    await rejects(zip([{ name: "meta.json", data: new TextEncoder().encode("[]"), deflate: false }]), "invalid-meta");
    await rejects(zip([{ name: "means_l.webp", data: webpStub }]), "missing-file");
    await rejects(zip([{ name: "dir/meta.json", data: webpStub }]), "unsafe-entry");
    await rejects(zip([{ name: "meta.json", data: webpStub, encrypted: true }]), "unsafe-entry");
    await rejects(zip([{ name: "meta.json", data: webpStub }, { name: "meta.json", data: webpStub }]), "unsafe-entry");
  });

  it("rejects invalid counts, bounds and codebooks", async () => {
    await rejects(bundle(metaV2({ count: 0 })), "invalid-meta");
    await rejects(bundle(metaV2({ count: 1.5 })), "invalid-meta");
    await rejects(bundle(metaV2({ means: { mins: [1, 1, 1], maxs: [0, 0, 0], files: ["means_l.webp", "means_u.webp"] } })), "invalid-meta");
    await rejects(bundle(metaV2({ scales: { codebook: [1, 2, 3], files: ["scales.webp"] } })), "invalid-meta");
    await rejects(bundle(metaV2({ sh0: { files: ["sh0.webp"] } })), "invalid-meta");
    // A null first entry is legal: the engine patches it.
    await inspectSogBundle(bundle(metaV2({ scales: { codebook: [null, ...codebook.slice(1)], files: ["scales.webp"] } })), inflate);
  });

  it("computes bounds with SOG's log-space position transform", () => {
    const b = sogBounds([0, 0, 0], [Math.log(3), Math.log(5), Math.log(9)]);
    assert.deepEqual(b.center.map((v) => +v.toFixed(9)), [1, 2, 4]);
  });
});

describe("SOG test fixture", () => {
  it("is deterministic", async () => {
    assert.deepEqual(await buildTestSog(lossless), await buildTestSog(lossless));
  });

  it("passes the Phase 2B-2 publishing validator and the runtime pre-check", async () => {
    const bytes = await buildTestSog(lossless);
    const findings = new Findings();
    const metrics = validateSog(bytes, findings);
    assert.deepEqual(findings.list.filter((f) => f.level === "fail"), []);
    const count = testSceneSplats().length;
    assert.equal(metrics?.gaussians, count);
    assert.equal(metrics?.metaVersion, 2);
    const summary = await inspectSogBundle(bytes, inflate);
    assert.equal(summary.gaussians, count);
    assert.ok(summary.bounds.radius > 4.2 && summary.bounds.radius < 4.5, `radius ${summary.bounds.radius}`);
    assert.ok(bytes.length < SPLAT_LIMITS.bytes.mobileTarget);
  });

  it("encodes positions that decode (as the engine does) back to the scene within quantisation error", () => {
    const splats = testSceneSplats();
    const { textures, meta } = encodeSog(splats);
    const [l, u] = textures;
    const means = meta.means as { mins: number[]; maxs: number[] };
    let worst = 0;
    splats.forEach((s, i) => {
      [s.x, s.y, s.z].forEach((expected, a) => {
        const n = ((u.rgba[i * 4 + a] << 8) + l.rgba[i * 4 + a]) / 65535;
        const v = means.mins[a] + (means.maxs[a] - means.mins[a]) * n;
        worst = Math.max(worst, Math.abs(Math.sign(v) * (Math.exp(Math.abs(v)) - 1) - expected));
      });
    });
    assert.ok(worst < 1e-3, `worst position error ${worst}`);
  });

  it("writes ZIPs with the end record last and correct CRCs", async () => {
    const z = storedZip([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    assert.equal(new DataView(z.buffer).getUint32(z.length - 22, true), 0x06054b50);
    assert.equal(new DataView(z.buffer).getUint32(14, true), 0x3610a686); // CRC-32 of "hello"
  });
});

// ── Size budgets ─────────────────────────────────────────────────────────────

describe("splat size budgets", () => {
  it("match the Phase 2B-2 publishing budgets", () => {
    assert.equal(SPLAT_LIMITS.bytes.mobileTarget, BYTE_BUDGETS.SPLAT.mobileTarget);
    assert.equal(SPLAT_LIMITS.bytes.desktopTarget, BYTE_BUDGETS.SPLAT.desktopTarget);
    assert.equal(SPLAT_LIMITS.bytes.hardLimit, BYTE_BUDGETS.SPLAT.hardLimit);
    assert.deepEqual(SPLAT_LIMITS.gaussians, SPLAT_GAUSSIAN_BUDGET);
  });

  it("classifies devices", () => {
    assert.equal(classifyDevice({ coarsePointer: true }), "constrained");
    assert.equal(classifyDevice({ coarsePointer: false, deviceMemoryGb: 4 }), "constrained");
    assert.equal(classifyDevice({ coarsePointer: false, deviceMemoryGb: 8 }), "standard");
    assert.equal(classifyDevice({ coarsePointer: false, deviceMemoryGb: null }), "standard");
    assert.equal(splatBudgetFor("constrained"), 1_000_000);
    assert.equal(splatBudgetFor("standard"), 3_000_000);
  });

  const MB = 1_000_000;
  const cases: [string, number | null, number | null, "constrained" | "standard", string][] = [
    ["small scene, phone", 5 * MB, 200_000, "constrained", "ok"],
    ["small scene, desktop", 5 * MB, 200_000, "standard", "ok"],
    ["unknown size and count", null, null, "constrained", "ok"],
    ["over the mobile byte target, phone", 30 * MB, 500_000, "constrained", "heavy"],
    ["over the mobile count target, phone", 10 * MB, 1_500_000, "constrained", "heavy"],
    ["same scene, desktop", 30 * MB, 1_500_000, "standard", "ok"],
    ["over the desktop target, desktop", 60 * MB, 2_000_000, "standard", "heavy"],
    ["over 3M splats, desktop", 40 * MB, 3_500_000, "standard", "heavy"],
    ["over the desktop target, phone", 60 * MB, 2_000_000, "constrained", "too-large"],
    ["over 3M splats, phone", 15 * MB, 3_500_000, "constrained", "too-large"],
    ["150 MB, phone", 150 * MB, null, "constrained", "too-large"],
    ["over the 80 MB hard limit, desktop", 81 * MB, 1_000_000, "standard", "too-large"],
  ];
  for (const [name, sizeBytes, gaussians, device, verdict] of cases) {
    it(`${name} → ${verdict}`, () => assert.equal(assessSplat({ sizeBytes, gaussians }, device).verdict, verdict));
  }
});

// ── Loader: download ─────────────────────────────────────────────────────────

const respond = (body: Uint8Array | null, init: { status?: number; type?: string; length?: number | null } = {}) => {
  const headers = new Headers({ "content-type": init.type ?? "application/zip" });
  if (init.length !== null && body) headers.set("content-length", String(init.length ?? body.length));
  const stream = body
    ? new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < body.length; i += 1000) controller.enqueue(body.slice(i, i + 1000));
          controller.close();
        },
      })
    : null;
  return new Response(stream, { status: init.status ?? 200, headers });
};
const fetchOf = (response: Response | (() => Promise<Response>)): typeof fetch => (async () => (typeof response === "function" ? response() : response)) as typeof fetch;

describe("splat loader: capped download", () => {
  const body = new Uint8Array(5000).map((_, i) => i & 0xff);

  it("returns the bytes of a SOG response, without credentials", async () => {
    let init: RequestInit | undefined;
    const f = (async (_url: string, i?: RequestInit) => {
      init = i;
      return respond(body);
    }) as typeof fetch;
    assert.deepEqual(await downloadSog("/x.sog", new AbortController().signal, 10_000, f), body);
    assert.equal(init?.credentials, "omit");
  });

  it("fails on HTTP errors and wrong content types", async () => {
    await assert.rejects(downloadSog("/x.sog", new AbortController().signal, 10_000, fetchOf(respond(body, { status: 404 }))), (e: unknown) => e instanceof SplatLoadError && e.kind === "http");
    await assert.rejects(downloadSog("/x.sog", new AbortController().signal, 10_000, fetchOf(respond(body, { type: "text/html" }))), (e: unknown) => e instanceof SplatLoadError && e.kind === "format");
  });

  it("refuses oversized files by declared length, and by bytes received when undeclared or understated", async () => {
    for (const length of [5000, null, 10]) {
      await assert.rejects(downloadSog("/x.sog", new AbortController().signal, 4000, fetchOf(respond(body, { length }))), (e: unknown) => e instanceof SplatLoadError && e.kind === "too-large");
    }
  });

  it("aborts with the signal", async () => {
    const controller = new AbortController();
    const f = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const pending = downloadSog("/x.sog", controller.signal, 10_000, f);
    controller.abort();
    await assert.rejects(pending, (e: unknown) => e instanceof DOMException && e.name === "AbortError");
  });

  it("retry after failure starts a fresh request; stale loads are superseded", async () => {
    let calls = 0;
    const flaky = (async () => (++calls === 1 ? respond(body, { status: 503 }) : respond(body))) as typeof fetch;
    await assert.rejects(downloadSog("/x.sog", new AbortController().signal, 10_000, flaky));
    assert.deepEqual(await downloadSog("/x.sog", new AbortController().signal, 10_000, flaky), body);
    const gate = new LoadGate();
    const first = gate.begin();
    const replacement = gate.begin();
    assert.ok(first.signal.aborted && !first.isCurrent() && replacement.isCurrent());
    gate.close();
    assert.ok(replacement.signal.aborted && !replacement.isCurrent(), "teardown aborts the in-flight load");
  });
});

// ── Media gating ─────────────────────────────────────────────────────────────

const SLUG = "demo-tower";
const row = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  status: "PUBLISHED",
  kind: "SPLAT",
  format: "SOG",
  subjectType: "PROJECT",
  projectSlug: SLUG,
  storageKey: `m/${ID}/3f9a1c2b7d4e8f60`,
  entryFile: "scene.sog",
  provenance: "AARVASA_RECONSTRUCTION",
  visibility: "PUBLIC",
  posterKey: `m/${ID}/3f9a1c2b7d4e8f60/poster.webp`,
  altText: "Reviewed scan of the show apartment",
  sizeBytes: 18_000_000,
  metrics: { gaussians: 850_000, shBands: 0 },
  dimensions: { entry: null, poster: { width: 1280, height: 720 } },
  viewDefaults: { yawDeg: 20, pitchDeg: 15, distance: 40 },
  ...extra,
});

describe("publication gating: published splat lookup", () => {
  it("queries only a PUBLISHED SPLAT/SOG of this project", () => {
    assert.deepEqual(publishedSplatQuery(SLUG, ID).where, {
      id: ID,
      status: "PUBLISHED",
      kind: "SPLAT",
      format: "SOG",
      subjectType: "PROJECT",
      projectSlug: SLUG,
      // Engineering scans are excluded by the query, not filtered after it.
      visibility: "PUBLIC",
      provenance: { not: "INTERNAL_TEST" },
    });
  });

  it("never selects private columns", () => {
    const selected = Object.keys(PUBLISHED_SPLAT_SELECT);
    for (const forbidden of ["sourceKey", "sourceChecksumSha256", "processingError", "failureCode", "reviewedById", "uploadedById", "rejectionReason", "processingLeaseExpiresAt"]) {
      assert.ok(!selected.includes(forbidden), forbidden);
    }
  });

  it("accepts a PUBLISHED splat, with public fields only", () => {
    assert.deepEqual(toPublishedSplat(row({ sourceKey: `uploads/${ID}/u/source.sog`, processingError: "boom" }), SLUG), {
      id: ID,
      entryKey: KEY,
      altText: "Reviewed scan of the show apartment",
      sizeBytes: 18_000_000,
      gaussians: 850_000,
      poster: { key: `m/${ID}/3f9a1c2b7d4e8f60/poster.webp`, width: 1280, height: 720 },
      initialView: { yawDeg: 20, pitchDeg: 15 },
    });
  });

  for (const status of ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "REJECTED", "FAILED", "ARCHIVED"]) {
    it(`rejects a ${status} splat even if a query returned it`, () => assert.equal(toPublishedSplat(row({ status }), SLUG), null));
  }

  const bad: [string, Record<string, unknown>][] = [
    ["another project", { projectSlug: "other-project" }],
    ["a property's asset", { subjectType: "PROPERTY", projectSlug: null }],
    ["a model", { kind: "MODEL", format: "GLB", entryFile: "scene.glb" }],
    ["a panorama", { kind: "PANORAMA", format: "EQUIRECT_JPEG", entryFile: "panorama.jpg" }],
    ["a non-SOG format", { format: "GLB" }],
    ["a review storage key", { storageKey: `review/${ID}/3f9a1c2b7d4e8f60` }],
    ["another asset's storage key", { storageKey: "m/cmother0000001/3f9a1c2b7d4e8f60" }],
    ["a traversal entry file", { entryFile: "../../review/x.sog" }],
    ["a PLY entry", { entryFile: "scene.ply" }],
    ["no alt text", { altText: "  " }],
    ["no size", { sizeBytes: null }],
    ["over the hard limit", { sizeBytes: 81_000_000 }],
  ];
  for (const [name, extra] of bad) it(`rejects ${name}`, () => assert.equal(toPublishedSplat(row(extra), SLUG), null));

  it("drops an invalid poster and absent metrics without dropping the scene", () => {
    const s = toPublishedSplat(row({ posterKey: "review/x/poster.webp", metrics: null }), SLUG);
    assert.equal(s?.poster, null);
    assert.equal(s?.gaussians, null);
    assert.equal(toPublishedSplat(null, SLUG), null);
  });
});

describe("publication gating: project splat mapping", () => {
  const dev = { nodeEnv: "development", cdnOrigin: CDN };
  const prod = { nodeEnv: "production", cdnOrigin: CDN };
  const published = toPublishedSplat(row(), SLUG);
  const project = (review: "approved" | "placeholder", scene: NonNullable<Project["splat"]>["scene"]): Pick<Project, "name" | "splat"> => ({
    name: "Demo Tower",
    splat: { label: "Demo Tower 3D scan", review, scene },
  });

  it("builds the viewer URL from the published key and the build's CDN origin", () => {
    const c = projectSplatConfig(project("approved", { source: "published", mediaAssetId: ID }), published, dev);
    assert.equal(c?.source.url, `${CDN}/${KEY}`);
    assert.equal(c?.poster?.src, `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/poster.webp`);
    assert.deepEqual([c?.source.sizeBytes, c?.source.gaussians], [18_000_000, 850_000]);
    assert.deepEqual(c?.source.initialView, { yawDeg: 20, pitchDeg: 15, distanceFactor: SPLAT_VIEW_LIMITS.defaultView.distanceFactor });
    assert.equal(c?.placeholder, false);
    assert.ok(!JSON.stringify(c).match(/uploads\/|review\/|originals\/|sourceKey|X-Amz/));
  });

  it("shows nothing when the named asset is not published (or a different asset came back)", () => {
    assert.equal(projectSplatConfig(project("approved", { source: "published", mediaAssetId: ID }), null, dev), null);
    assert.equal(projectSplatConfig(project("approved", { source: "published", mediaAssetId: "cmother0000001" }), published, dev), null);
  });

  it("never shows placeholders or fixtures in production, nor CDN media without a production origin", () => {
    assert.equal(projectSplatConfig(project("placeholder", { source: "fixture", fixture: "test-scene" }), null, prod), null);
    assert.equal(projectSplatConfig(project("approved", { source: "fixture", fixture: "test-scene" }), null, prod), null);
    assert.equal(projectSplatConfig(project("approved", { source: "published", mediaAssetId: ID }), published, prod), null);
  });

  it("serves the labelled fixture in development and refuses unknown fixtures", () => {
    const c = projectSplatConfig(project("placeholder", { source: "fixture", fixture: "test-scene" }), null, dev);
    assert.equal(c?.source.url, "/labs/splats/test-scene.sog");
    assert.equal(c?.placeholder, true);
    assert.match(c?.label ?? "", /\(placeholder\)$/);
    assert.equal(projectSplatConfig(project("placeholder", { source: "fixture", fixture: "../../etc/passwd" }), null, dev), null);
  });

  it("looks up at most the one referenced asset", () => {
    assert.equal(splatMediaAssetId(project("approved", { source: "published", mediaAssetId: ID })), ID);
    assert.equal(splatMediaAssetId(project("placeholder", { source: "fixture", fixture: "test-scene" })), null);
    assert.equal(splatMediaAssetId({}), null);
  });
});

// ── Project integration ──────────────────────────────────────────────────────

describe("project page integration: experiences offered", () => {
  const combos: [string, boolean, boolean, boolean, string[]][] = [
    ["A. model only", true, false, false, ["model"]],
    ["B. panorama only", false, true, false, ["panorama"]],
    ["C. splat only", false, false, true, ["splat"]],
    ["D. model + panorama", true, true, false, ["model", "panorama"]],
    ["E. model + splat", true, false, true, ["model", "splat"]],
    ["F. panorama + splat", false, true, true, ["panorama", "splat"]],
    ["G. all three", true, true, true, ["model", "panorama", "splat"]],
    ["H. none (no section)", false, false, false, []],
  ];
  for (const [name, model, tour, splat, expected] of combos) {
    it(name, () => assert.deepEqual(immersiveModes({ model: model ? {} : null, tour: tour ? {} : null, splat: splat ? {} : null }), expected));
  }

  it("a failed or unpublished splat simply is not offered", () => {
    const failed = projectSplatConfig({ name: "X", splat: { label: "X", review: "approved", scene: { source: "published", mediaAssetId: ID } } }, toPublishedSplat(row({ status: "FAILED" }), SLUG), { nodeEnv: "development", cdnOrigin: CDN });
    assert.deepEqual(immersiveModes({ model: {}, tour: null, splat: failed }), ["model"]);
  });

  it("REEF 996 is offered no splat at all: the pilot scan is engineering material", () => {
    // It used to be attached here and shown in development. A scan of coloured
    // axis markers on a Dubai tower's page is a test asset wearing a product's
    // clothes, so it was moved to /labs and the project offers nothing.
    const reef = getProject("reef-996-dubai-production-city") as Project;
    assert.equal(projectSplatConfig(reef, null, { nodeEnv: "development", cdnOrigin: CDN }), null);
    assert.equal(projectSplatConfig(reef, null, { nodeEnv: "production", cdnOrigin: CDN }), null);
    assert.equal(splatMediaAssetId(reef), null);
  });
});

describe("splat analytics", () => {
  it("allows the splat events with id-like properties only", () => {
    assert.deepEqual(sanitizeViewerEvent("splat_error", { project: "demo-tower", errorKind: "too-large", url: `${CDN}/${KEY}`, message: "HTTP 403" }), {
      name: "splat_error",
      props: { project: "demo-tower", errorKind: "too-large" },
    });
    assert.deepEqual(sanitizeViewerEvent("viewer_mode_selected", { mode: "splat" })?.props, { mode: "splat" });
    assert.ok(sanitizeViewerEvent("splat_opened") && sanitizeViewerEvent("splat_loaded"));
  });
});
