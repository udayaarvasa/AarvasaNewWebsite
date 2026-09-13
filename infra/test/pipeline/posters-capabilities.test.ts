import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadSharpPosterGenerator, POSTER_HEIGHT, POSTER_WIDTH } from "../../src/pipeline/adapters";
import { readWebp, sha256Hex } from "../../src/pipeline/formats";
import { processAssets } from "../../src/pipeline/process";
import { PLAYCANVAS_VERSION, REJECTED_GLTF_EXTENSIONS, SUPPORTED_GLTF_EXTENSIONS } from "../../src/pipeline/viewer-capabilities";
import { tempDir } from "./fixtures";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

describe("viewer capabilities match the installed PlayCanvas engine", () => {
  const engine = join(REPO_ROOT, "node_modules", "playcanvas");
  const available = existsSync(join(engine, "package.json"));

  it("pins the same PlayCanvas version as the app", { skip: !available && "root dependencies not installed" }, () => {
    const pkg = JSON.parse(readFileSync(join(engine, "package.json"), "utf8")) as { version: string };
    assert.equal(pkg.version, PLAYCANVAS_VERSION);
  });

  it("lists exactly the glTF extensions the engine parser implements, and no meshopt", { skip: !available && "root dependencies not installed" }, () => {
    const dir = join(engine, "build", "playcanvas", "src", "framework", "parsers", "glb");
    const source = [...readdirSync(join(dir, "extensions")).map((f) => join(dir, "extensions", f)), join(dir, "..", "glb-parser.js")]
      .filter((f) => f.endsWith(".js"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const implemented = [...new Set(source.match(/\b(?:KHR|EXT)_[A-Za-z_]+\b/g) ?? [])].sort();
    assert.deepEqual([...SUPPORTED_GLTF_EXTENSIONS].sort(), implemented);
    for (const ext of REJECTED_GLTF_EXTENSIONS) assert.ok(!implemented.includes(ext), ext);
  });
});

describe("panorama poster generation (sharp from the app's dependencies)", () => {
  const generator = loadSharpPosterGenerator({});
  const skip = !generator && "sharp is not installed in the repository";

  it("can be disabled explicitly", () => {
    assert.equal(loadSharpPosterGenerator({ AARVASA_MEDIA_POSTERS: "off" }), null);
  });

  it("generates a deterministic 1280×640 WebP poster without touching the source", { skip }, async () => {
    const sharp = createRequire(join(REPO_ROOT, "package.json"))("sharp") as (options: object) => {
      jpeg(o: object): { toBuffer(): Promise<Buffer> };
    };
    const source = await sharp({ create: { width: 4096, height: 2048, channels: 3, background: { r: 120, g: 40, b: 50 } } })
      .jpeg({ quality: 85 })
      .toBuffer();
    const dir = await tempDir();
    await import("node:fs/promises").then((fs) => fs.writeFile(join(dir, "terrace.jpg"), source));

    const first = await processAssets(dir, { setId: "posters", posterGenerator: generator });
    const second = await processAssets(dir, { setId: "posters", posterGenerator: generator });
    const [item] = first.manifest.items;
    assert.equal(item.status, "pass", JSON.stringify(item.validation));
    assert.equal(item.poster?.origin, "generated");
    assert.equal(item.poster?.width, POSTER_WIDTH);
    assert.equal(item.poster?.height, POSTER_HEIGHT);
    assert.equal(item.poster?.key, `${item.storageKey}/poster.webp`);
    assert.deepEqual(first.manifest, second.manifest, "same source and generator give the same keys and poster hash");

    const staged = first.staged.find((s) => s.key === item.poster?.key);
    assert.ok(staged?.bytes);
    assert.equal(sha256Hex(staged.bytes), item.poster?.sha256);
    assert.deepEqual(readWebp(staged.bytes) && { w: readWebp(staged.bytes)?.width, h: readWebp(staged.bytes)?.height }, { w: 1280, h: 640 });
    const onDisk = await import("node:fs/promises").then((fs) => fs.readFile(join(dir, "terrace.jpg")));
    assert.equal(sha256Hex(onDisk), sha256Hex(source), "source is not modified");
  });

  it("fails the item when the panorama header is valid but the image cannot be decoded", { skip }, async () => {
    const dir = await tempDir();
    const { jpeg } = await import("./fixtures");
    await import("node:fs/promises").then((fs) => fs.writeFile(join(dir, "broken.jpg"), jpeg(4096, 2048)));
    const { manifest } = await processAssets(dir, { posterGenerator: generator });
    assert.ok(manifest.items[0].validation.some((f) => f.rule === "poster.generated" && f.level === "fail"));
  });
});
