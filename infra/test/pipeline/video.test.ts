import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publishedObjectMetadata } from "../../../shared/media-contract";
import { Findings } from "../../src/pipeline/findings";
import { readMp4, sniff } from "../../src/pipeline/formats";
import { type ItemManifest, processAssets } from "../../src/pipeline/process";
import { validateMp4 } from "../../src/pipeline/video";
import { classifyValidationFailure } from "../../src/processing/failure-classification";
import { jpeg, mp4, tempDir, writeFiles } from "./fixtures";

const levels = (f: Findings) => f.list.map((x) => `${x.level}:${x.rule}`);
const byName = (items: readonly ItemManifest[], name: string) => {
  const item = items.find((i) => i.source.filename === name);
  assert.ok(item, name);
  return item;
};

describe("MP4 reader", () => {
  it("recognises the ISO base media container without claiming it is playable", () => {
    assert.equal(sniff(mp4()), "isobmff");
    // QuickTime shares the container; the sniffer must not call it MP4.
    assert.equal(sniff(mp4({ brand: "qt  ", compatible: ["qt  "] })), "isobmff");
    assert.notEqual(sniff(jpeg(64, 32)), "isobmff");
  });

  it("reads brand, box order, duration, codec, audio and frame size", () => {
    const info = readMp4(mp4());
    assert.ok(info);
    assert.equal(info.majorBrand, "isom");
    assert.deepEqual(info.topLevel, ["ftyp", "moov", "mdat"]);
    assert.equal(info.faststart, true);
    assert.equal(info.durationSeconds, 21);
    assert.equal(info.videoCodec, "avc1");
    assert.equal(info.hasAudio, true);
    assert.equal(info.width, 480);
    assert.equal(info.height, 848);
  });

  it("reads version-1 headers the same way", () => {
    const info = readMp4(mp4({ version1: true, durationSeconds: 42.917 }));
    assert.equal(info?.durationSeconds, 42.917);
    assert.equal(info?.width, 480);
    assert.equal(info?.height, 848);
  });

  it("applies the rotation matrix, so a phone clip stored on its side is reported as the portrait it is", () => {
    const info = readMp4(mp4({ width: 848, height: 480, rotate90: true }));
    assert.equal(info?.width, 480);
    assert.equal(info?.height, 848);
  });

  it("notices when the index comes after the media", () => {
    assert.equal(readMp4(mp4({ faststart: false }))?.faststart, false);
  });

  it("handles a 64-bit box size", () => {
    assert.deepEqual(readMp4(mp4({ largeMdat: true }))?.topLevel, ["ftyp", "moov", "mdat"]);
  });

  it("returns nothing for a malformed or headless file rather than guessing", () => {
    const good = mp4();
    // A box that claims to be longer than the file.
    const overrun = new Uint8Array(good);
    new DataView(overrun.buffer).setUint32(0, good.length * 4);
    assert.equal(readMp4(overrun), null);
    // No moov.
    assert.equal(readMp4(mp4({ mdat: true, video: false, audio: false }).slice(0, 32)), null);
    assert.equal(readMp4(new Uint8Array(4)), null);
  });
});

describe("MP4 validation", () => {
  it("passes a portrait H.264 film and records what a page needs", () => {
    const f = new Findings();
    const result = validateMp4(mp4(), f);
    assert.ok(result);
    assert.equal(f.failed, false);
    assert.deepEqual([result.width, result.height], [480, 848]);
    assert.equal(result.metrics.orientation, "portrait");
    assert.equal(result.metrics.codec, "avc1");
    assert.equal(result.metrics.durationSeconds, 21);
    assert.ok(levels(f).includes("pass:video.codec"));
  });

  it("refuses QuickTime and HEIC dressed as .mp4", () => {
    for (const bytes of [mp4({ brand: "qt  ", compatible: ["qt  "] }), mp4({ brand: "heic", compatible: ["mif1", "heic"] })]) {
      const f = new Findings();
      assert.equal(validateMp4(bytes, f), null);
      assert.equal(f.failed, true);
      assert.ok(levels(f).includes("fail:video.brand"));
    }
  });

  it("refuses a file with no video track", () => {
    const f = new Findings();
    assert.equal(validateMp4(mp4({ video: false }), f), null);
    assert.ok(levels(f).includes("fail:video.track"));
  });

  it("refuses a codec no browser plays, and warns on one only some do", () => {
    const refused = new Findings();
    assert.equal(validateMp4(mp4({ codec: "mp4v" }), refused), null);
    assert.ok(levels(refused).includes("fail:video.codec"));

    const partial = new Findings();
    assert.ok(validateMp4(mp4({ codec: "hvc1" }), partial));
    assert.equal(partial.failed, false);
    assert.ok(levels(partial).includes("warn:video.codec"));
  });

  it("warns, but does not refuse, a film whose index follows its media", () => {
    const f = new Findings();
    assert.ok(validateMp4(mp4({ faststart: false }), f));
    assert.equal(f.failed, false);
    assert.ok(levels(f).includes("warn:video.faststart"));
  });

  it("says plainly that a 2:1 frame will be shown flat, never as 360", () => {
    const f = new Findings();
    assert.ok(validateMp4(mp4({ width: 1920, height: 960 }), f));
    const warning = f.list.find((x) => x.rule === "video.equirect-aspect");
    assert.ok(warning);
    assert.match(warning.message, /never as 360/);
  });

  it("refuses a header with no media data", () => {
    const f = new Findings();
    assert.equal(validateMp4(mp4({ mdat: false }), f), null);
    assert.equal(f.failed, true);
  });
});

describe("pipeline: VIDEO through the shared processor", () => {
  it("publishes an .mp4 as VIDEO/MP4, byte for byte, served as video/mp4, with no poster required", async () => {
    const dir = await tempDir();
    const bytes = mp4();
    await writeFiles(dir, { "tour.mp4": bytes });
    const { manifest, staged } = await processAssets(dir, { setId: "reef-998-films", posterGenerator: null });
    const item = byName(manifest.items, "tour.mp4");
    assert.equal(item.kind, "VIDEO");
    assert.equal(item.format, "MP4");
    assert.notEqual(item.status, "fail");
    assert.equal(item.entryFile, "film.mp4");
    assert.deepEqual(item.dimensions, { width: 480, height: 848 });
    assert.equal(item.poster, null);
    const entry = item.objects.find((o) => o.role === "entry");
    assert.ok(entry);
    assert.equal(entry.contentType, "video/mp4");
    assert.equal(publishedObjectMetadata(entry.key)?.contentType, "video/mp4");
    // Passthrough: the staged bytes are the uploaded bytes.
    const stagedEntry = staged.find((s) => s.key === entry.key);
    assert.ok(stagedEntry);
    assert.equal(entry.sizeBytes, bytes.length);
    // A missing poster is a warning, never a reason to refuse a film.
    assert.ok(item.validation.some((v) => v.rule === "poster.missing" && v.level === "warn"));
  });

  it("refuses QuickTime, WebM and the rest by extension, naming MP4", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "clip.mov": mp4({ brand: "qt  ", compatible: ["qt  "] }), "clip.webm": new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]) });
    const { manifest } = await processAssets(dir, { setId: "s", posterGenerator: null });
    for (const name of ["clip.mov", "clip.webm"]) {
      const item = byName(manifest.items, name);
      assert.equal(item.status, "fail");
      const reason = item.validation.find((v) => v.rule === "input.extension");
      assert.match(reason?.message ?? "", /MP4/);
    }
  });

  it("refuses a JPEG renamed to .mp4", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "fake.mp4": jpeg(64, 32) });
    const { manifest } = await processAssets(dir, { setId: "s", posterGenerator: null });
    const item = byName(manifest.items, "fake.mp4");
    assert.equal(item.status, "fail");
    assert.ok(item.validation.some((v) => v.rule === "mime.content-mismatch"));
  });

  it("does not count a film toward what a listing loads before interaction", async () => {
    const dir = await tempDir();
    const pano = jpeg(4096, 2048);
    await writeFiles(dir, { "terrace.jpg": pano, "tour.mp4": mp4() });
    const { manifest } = await processAssets(dir, { setId: "s", posterGenerator: null });
    const panoItem = byName(manifest.items, "terrace.jpg");
    // The film is larger than nothing here; the initial view is the panorama alone.
    assert.equal(manifest.totals.initialViewBytes, panoItem.sizeBytes);
  });

  it("classifies a wrong-kind file as unsupported content, a broken one as a validation failure", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "quicktime.mp4": mp4({ brand: "qt  ", compatible: ["qt  "] }),
      "silent.mp4": mp4({ video: false }),
    });
    const { manifest } = await processAssets(dir, { setId: "s", posterGenerator: null });
    assert.equal(classifyValidationFailure(byName(manifest.items, "quicktime.mp4")).code, "UNSUPPORTED_CONTENT");
    assert.equal(classifyValidationFailure(byName(manifest.items, "silent.mp4")).code, "VALIDATION_FAILED");
  });
});
