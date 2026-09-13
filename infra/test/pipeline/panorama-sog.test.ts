import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Findings } from "../../src/pipeline/findings";
import { validatePanorama } from "../../src/pipeline/panorama";
import { validateSog } from "../../src/pipeline/sog";
import { jpeg, sogBundle, webp, zip } from "./fixtures";

const rules = (findings: Findings, level: "pass" | "warn" | "fail") => findings.list.filter((f) => f.level === level).map((f) => f.rule);

describe("panorama validation", () => {
  const check = (bytes: Uint8Array, kind: "jpeg" | "webp" = "jpeg") => {
    const findings = new Findings();
    const result = validatePanorama(bytes, kind, findings);
    return { findings, result };
  };

  it("accepts exact 2:1 equirectangular JPEG and WebP at the mobile target", () => {
    const j = check(jpeg(4096, 2048));
    assert.equal(j.findings.status, "pass", JSON.stringify(j.findings.list));
    assert.deepEqual(j.result, { format: "EQUIRECT_JPEG", width: 4096, height: 2048 });
    const w = check(webp(4096, 2048, { lossless: false }), "webp");
    assert.equal(w.findings.status, "pass");
    assert.equal(w.result?.format, "EQUIRECT_WEBP");
  });

  it("rejects panoramas that are not exactly 2:1", () => {
    for (const [width, height] of [[4096, 2047], [4000, 3000], [2048, 2048], [8192, 4095]]) {
      const { findings } = check(jpeg(width, height));
      assert.ok(rules(findings, "fail").includes("panorama.aspect-ratio"), `${width}×${height}`);
    }
  });

  it("warns above the mobile width and fails above the supported maximum", () => {
    const desktop = check(jpeg(8192, 4096));
    assert.equal(desktop.findings.status, "warn");
    assert.ok(rules(desktop.findings, "warn").includes("panorama.resolution"));
    const tooWide = check(jpeg(16384, 8192));
    assert.ok(rules(tooWide.findings, "fail").includes("panorama.resolution"));
    assert.ok(rules(check(jpeg(1024, 512)).findings, "warn").includes("panorama.resolution"));
  });

  it("fails GPS metadata, CMYK JPEGs and animated WebP; warns for other EXIF and progressive JPEG", () => {
    assert.ok(rules(check(jpeg(4096, 2048, { gps: true })).findings, "fail").includes("panorama.gps"));
    assert.ok(rules(check(webp(4096, 2048, { lossless: false, gps: true }), "webp").findings, "fail").includes("panorama.gps"));
    assert.ok(rules(check(jpeg(4096, 2048, { components: 4 })).findings, "fail").includes("panorama.color"));
    assert.ok(rules(check(webp(4096, 2048, { lossless: false, animated: true }), "webp").findings, "fail").includes("panorama.animated"));
    const exif = check(jpeg(4096, 2048, { exif: true }));
    assert.equal(exif.findings.status, "warn");
    assert.ok(rules(exif.findings, "warn").includes("panorama.exif"));
    assert.ok(rules(check(jpeg(4096, 2048, { progressive: true })).findings, "warn").includes("panorama.progressive"));
  });
});

describe("SOG bundle validation", () => {
  const check = (bytes: Uint8Array) => {
    const findings = new Findings();
    return { findings, result: validateSog(bytes, findings) };
  };

  it("accepts a v2 bundle of lossless WebP attribute images", () => {
    const { findings, result } = check(sogBundle({ count: 500_000 }));
    assert.equal(findings.status, "pass", JSON.stringify(findings.list));
    assert.equal(result?.gaussians, 500_000);
    assert.equal(result?.metaVersion, 2);
    assert.equal(result?.streamingCandidate, false);
  });

  it("accepts v1 meta.json, which the engine upgrades", () => {
    const { findings, result } = check(sogBundle({ version: 1, count: 1000 }));
    assert.equal(findings.status, "pass", JSON.stringify(findings.list));
    assert.equal(result?.metaVersion, 1);
    assert.equal(result?.gaussians, 1000);
  });

  it("warns above gaussian targets and flags large scenes for streaming", () => {
    const mobile = check(sogBundle({ count: 2_000_000 }));
    assert.equal(mobile.findings.status, "warn");
    assert.equal(mobile.result?.streamingCandidate, false);
    const desktop = check(sogBundle({ count: 5_000_000 }));
    assert.ok(rules(desktop.findings, "warn").includes("sog.streaming-candidate"));
    assert.equal(desktop.result?.streamingCandidate, true);
  });

  it("rejects lossy WebP, missing, unreferenced and nested entries", () => {
    assert.ok(rules(check(sogBundle({ lossy: "quats.webp" })).findings, "fail").includes("sog.webp"));
    assert.ok(rules(check(sogBundle({ omit: "scales.webp" })).findings, "fail").includes("sog.files"));
    assert.ok(rules(check(sogBundle({ extraFile: "payload.webp" })).findings, "fail").includes("sog.files"));
    assert.ok(rules(check(sogBundle({ nameOverride: ["sh0.webp", "../sh0.webp"] })).findings, "fail").includes("sog.entries"));
    assert.ok(rules(check(sogBundle({ nameOverride: ["sh0.webp", "nested/sh0.webp"] })).findings, "fail").includes("sog.entries"));
  });

  it("rejects archives without meta.json, corrupt archives and CRC mismatches", () => {
    const noMeta = zip([{ name: "means_l.webp", data: webp(8, 8, { lossless: true }) }]);
    assert.ok(rules(check(noMeta).findings, "fail").includes("sog.meta"));
    assert.ok(rules(check(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])).findings, "fail").includes("sog.zip"));

    const corrupted = Uint8Array.from(sogBundle({ deflateMeta: false }));
    const at = Buffer.from(corrupted).indexOf('"count"');
    corrupted[at + 1] = "k".charCodeAt(0);
    assert.ok(rules(check(corrupted).findings, "fail").includes("sog.zip"));
  });

  it("rejects entries that declare more data than the zip-bomb limit", () => {
    const bomb = Uint8Array.from(sogBundle());
    const view = new DataView(bomb.buffer);
    const eocd = bomb.length - 22;
    const cdOffset = view.getUint32(eocd + 16, true);
    view.setUint32(cdOffset + 24, 0xfffffff0, true); // uncompressed size of the first entry
    assert.ok(rules(check(bomb).findings, "fail").includes("sog.zip-bomb"));
  });
});
