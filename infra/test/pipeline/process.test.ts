import assert from "node:assert/strict";
import { mkdir, readdir, symlink, truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { MB } from "../../src/media-budgets";
import { MEDIA_KEY_PATTERN, publishedObjectMetadata } from "../../../shared/media-contract";
import { Findings } from "../../src/pipeline/findings";
import { sha256Hex } from "../../src/pipeline/formats";
import {
  checkSetBudgets,
  deriveKeyHash,
  deriveMediaId,
  type ItemManifest,
  processAssets,
  UsageError,
} from "../../src/pipeline/process";
import { glb, glbFrom, jpeg, ktx2, sogBundle, tempDir, triangleGltf, webp, writeFiles } from "./fixtures";

const noPosters = { posterGenerator: null };
const byName = (items: readonly ItemManifest[], name: string) => {
  const item = items.find((i) => i.source.filename === name);
  assert.ok(item, name);
  return item;
};
const ruleLevels = (item: ItemManifest) => item.validation.map((f) => `${f.level}:${f.rule}`);

async function mixedSet(): Promise<string> {
  const dir = await tempDir();
  await writeFiles(dir, {
    "lobby.glb": glbFrom(triangleGltf()),
    "lobby.poster.webp": webp(1280, 720, { lossless: false }),
    "terrace.jpg": jpeg(4096, 2048),
    "garden.sog": sogBundle({ count: 400_000 }),
    "brdf.ktx2": ktx2({ width: 512, height: 512 }),
  });
  return dir;
}

describe("pipeline: set processing and manifest", () => {
  it("builds a manifest with immutable keys, MIME types, hashes and sizes", async () => {
    const dir = await mixedSet();
    const { manifest, staged } = await processAssets(dir, { setId: "reef-996-demo", ...noPosters });

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.setId, "reef-996-demo");
    assert.deepEqual(manifest.pipeline, {
      name: "aarvasa-media-pipeline",
      version: "1.0.0",
      profile: "passthrough-v1",
      viewerEngine: "playcanvas@2.22.2",
      posterGenerator: null,
    });
    assert.equal(manifest.totals.items, 4);
    assert.equal(manifest.totals.fail, 0);

    const lobby = byName(manifest.items, "lobby.glb");
    assert.equal(lobby.kind, "MODEL");
    assert.equal(lobby.format, "GLB");
    assert.equal(lobby.mediaId, deriveMediaId("reef-996-demo", "lobby.glb"));
    assert.equal(lobby.entryFile, "scene.glb");
    assert.equal(lobby.mimeType, "model/gltf-binary");
    assert.equal(lobby.contentHash, lobby.source.sha256);
    assert.match(lobby.storageKey ?? "", /^m\/[a-z0-9]{24}\/[a-f0-9]{16}$/);
    assert.equal(lobby.poster?.origin, "sidecar");
    assert.equal(lobby.poster?.key, `${lobby.storageKey}/poster.webp`);
    assert.equal(lobby.status, "pass");

    const terrace = byName(manifest.items, "terrace.jpg");
    assert.deepEqual(terrace.dimensions, { width: 4096, height: 2048 });
    assert.equal(terrace.entryFile, "panorama.jpg");
    assert.equal(terrace.status, "warn", "no poster generator and no sidecar");
    assert.ok(ruleLevels(terrace).includes("warn:poster.missing"));

    const garden = byName(manifest.items, "garden.sog");
    assert.equal(garden.mimeType, "application/zip");
    assert.equal(garden.metrics.gaussians, 400_000);

    const texture = byName(manifest.items, "brdf.ktx2");
    assert.equal(texture.mimeType, "image/ktx2");
    assert.ok(ruleLevels(texture).includes("warn:size.no-approved-budget"));

    for (const item of manifest.items) {
      for (const object of item.objects) {
        assert.match(object.key, MEDIA_KEY_PATTERN, object.key);
        assert.deepEqual(publishedObjectMetadata(object.key), { contentType: object.contentType, cacheControl: object.cacheControl });
        assert.equal(object.cacheControl, "public, max-age=31536000, immutable");
      }
    }
    assert.equal(staged.length, 5, "4 entries + 1 sidecar poster");
    const json = JSON.stringify(manifest);
    assert.ok(!/https?:\/\//.test(json), "manifest contains object keys, never URLs");
    assert.ok(!json.includes(dir), "manifest contains no local paths");
  });

  it("is deterministic: same inputs give identical manifests and keys", async () => {
    const a = await processAssets(await mixedSet(), { setId: "same", ...noPosters });
    const b = await processAssets(await mixedSet(), { setId: "same", ...noPosters });
    assert.deepEqual(a.manifest, b.manifest);
  });

  it("gives a new version path when content changes, keeping the media id", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "tower.glb": glbFrom(triangleGltf()) });
    const before = await processAssets(dir, { setId: "s", ...noPosters });
    const changed = triangleGltf();
    changed.json.asset = { version: "2.0", generator: "re-export" };
    await writeFiles(dir, { "tower.glb": glbFrom(changed) });
    const after = await processAssets(dir, { setId: "s", ...noPosters });
    const [x, y] = [before.manifest.items[0], after.manifest.items[0]];
    assert.equal(x.mediaId, y.mediaId);
    assert.notEqual(x.storageKey, y.storageKey);
    assert.notEqual(x.contentHash, y.contentHash);
  });

  it("derives key hashes from the entry hash and the poster input", () => {
    const entry = sha256Hex(Buffer.from("entry"));
    assert.equal(deriveKeyHash(entry, "none"), deriveKeyHash(entry, "none"));
    assert.notEqual(deriveKeyHash(entry, "none"), deriveKeyHash(entry, "sidecar:abc"));
    assert.match(deriveKeyHash(entry, "none"), /^[a-f0-9]{16}$/);
  });

  it("does not mutate source files", async () => {
    const dir = await mixedSet();
    const hashOf = async () => {
      const out: Record<string, string> = {};
      for (const name of (await readdir(dir)).sort()) out[name] = sha256Hex(await import("node:fs/promises").then((fs) => fs.readFile(join(dir, name))));
      return out;
    };
    const before = await hashOf();
    await processAssets(dir, { ...noPosters });
    assert.deepEqual(await hashOf(), before);
    assert.deepEqual((await readdir(dir)).sort(), Object.keys(before));
  });
});

describe("pipeline: rejection and failure behaviour", () => {
  it("rejects unsupported and deliberately excluded extensions", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "scene.gltf": Buffer.from('{"asset":{"version":"2.0"}}'),
      "capture.ply": Buffer.from("ply\nformat binary_little_endian 1.0\n"),
      "index.html": Buffer.from("<script>alert(1)</script>"),
      "plan.png": new Uint8Array(16),
      "README": Buffer.from("x"),
    });
    const { manifest } = await processAssets(dir, noPosters);
    assert.equal(manifest.status, "fail");
    for (const item of manifest.items) {
      assert.equal(item.status, "fail", item.source.filename);
      assert.ok(ruleLevels(item).includes("fail:input.extension"));
      assert.equal(item.storageKey, null);
      assert.deepEqual(item.objects, []);
    }
    assert.match(byName(manifest.items, "scene.gltf").errors[0], /single binary \.glb/);
  });

  it("rejects content that does not match its extension", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "model.glb": jpeg(64, 32), "pano.jpg": glbFrom(triangleGltf()), "splat.sog": webp(8, 8, { lossless: true }) });
    const { manifest } = await processAssets(dir, noPosters);
    for (const item of manifest.items) assert.ok(ruleLevels(item).includes("fail:mime.content-mismatch"), item.source.filename);
  });

  it("fails an asset above its hard limit but only warns above targets", async () => {
    const dir = await tempDir();
    const big = triangleGltf();
    const binSize = 51 * MB;
    const bin = Buffer.alloc(binSize);
    Buffer.from(big.bin).copy(bin);
    big.json.buffers = [{ byteLength: binSize }];
    await writeFiles(dir, {
      "hard.glb": glb(big.json, bin),
      "desktop.jpg": jpeg(4096, 2048, { padTo: 9 * MB }),
      "mobile.jpg": jpeg(4096, 2048, { padTo: 3 * MB }),
      "limit.jpg": jpeg(4096, 2048, { padTo: 12 * MB + 1 }),
    });
    const { manifest } = await processAssets(dir, noPosters);
    assert.ok(ruleLevels(byName(manifest.items, "hard.glb")).includes("fail:size.hard-limit"));
    assert.ok(ruleLevels(byName(manifest.items, "limit.jpg")).includes("fail:size.hard-limit"));
    const desktop = byName(manifest.items, "desktop.jpg");
    assert.ok(ruleLevels(desktop).includes("warn:size.desktop-target"));
    assert.notEqual(desktop.status, "fail");
    assert.ok(ruleLevels(byName(manifest.items, "mobile.jpg")).includes("warn:size.mobile-target"));
  });

  it("refuses to read sources above the source maximum", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "huge.glb"), glbFrom(triangleGltf()));
    await truncate(join(dir, "huge.glb"), 251 * MB); // sparse: no data written
    await writeFile(join(dir, "huge.jpg"), jpeg(4096, 2048));
    await truncate(join(dir, "huge.jpg"), 51 * MB);
    await writeFile(join(dir, "huge.sog"), sogBundle());
    await truncate(join(dir, "huge.sog"), 81 * MB);
    const { manifest } = await processAssets(dir, noPosters);
    for (const item of manifest.items) {
      assert.ok(ruleLevels(item).includes("fail:size.source-max"), item.source.filename);
      assert.equal(item.source.sha256, null, "file was not read");
    }
  });

  it("does not follow symbolic links and reports subdirectories", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "real.glb": glbFrom(triangleGltf()) });
    await symlink(join(dir, "real.glb"), join(dir, "link.glb"));
    await mkdir(join(dir, "nested"));
    const { manifest } = await processAssets(dir, noPosters);
    assert.ok(ruleLevels(byName(manifest.items, "link.glb")).includes("fail:input.file"));
    assert.ok(manifest.validation.some((f) => f.rule === "input.subdirectory"));
  });

  it("fails an item whose sidecar poster is invalid and never publishes its key", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "a.glb": glbFrom(triangleGltf()), "a.poster.webp": jpeg(64, 32) });
    const { manifest, staged } = await processAssets(dir, noPosters);
    assert.ok(ruleLevels(manifest.items[0]).includes("fail:poster.mime"));
    assert.deepEqual(staged, []);
  });

  it("throws usage errors for missing input, empty sets and misused media ids", async () => {
    await assert.rejects(processAssets("/definitely/not/here", noPosters), UsageError);
    await assert.rejects(processAssets(await tempDir(), noPosters), UsageError);
    const dir = await mixedSet();
    await assert.rejects(processAssets(dir, { mediaId: "abcdefgh1234", ...noPosters }), /single media file/);
    await assert.rejects(processAssets(join(dir, "lobby.glb"), { mediaId: "BAD", ...noPosters }), /--media-id/);
    const single = await processAssets(join(dir, "lobby.glb"), { mediaId: "cmlobby00001", ...noPosters });
    assert.equal(single.manifest.items[0].mediaId, "cmlobby00001");
    assert.equal(single.manifest.items[0].poster?.origin, "sidecar", "single-file mode still finds the sidecar");
  });
});

describe("pipeline: per-listing budgets", () => {
  it("passes within targets", () => {
    const findings = new Findings();
    assert.deepEqual(checkSetBudgets(findings, 100 * MB, 20 * MB), { reviewRequired: false });
    assert.equal(findings.status, "pass");
  });

  it("warns when the initial view exceeds 25 MB", () => {
    const findings = new Findings();
    checkSetBudgets(findings, 30 * MB, 25 * MB + 1);
    assert.equal(findings.status, "warn");
    assert.ok(findings.list.some((f) => f.rule === "set.initial-view-target" && f.level === "warn"));
  });

  it("requires explicit review above 400 MB published, as a warning not a failure", () => {
    const findings = new Findings();
    assert.deepEqual(checkSetBudgets(findings, 400 * MB + 1, 10 * MB), { reviewRequired: true });
    assert.equal(findings.status, "warn");
  });
});
