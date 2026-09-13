import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { main, parseArgs } from "../../src/pipeline/cli";
import { UsageError } from "../../src/pipeline/process";
import { glbFrom, jpeg, tempDir, triangleGltf, webp, writeFiles } from "./fixtures";

const ENV = { AARVASA_MEDIA_POSTERS: "off" } as NodeJS.ProcessEnv;

/** Runs the CLI with stdout/stderr captured. */
async function cli(args: string[], env: NodeJS.ProcessEnv = ENV) {
  let stdout = "";
  let stderr = "";
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array) => ((stdout += String(chunk)), true)) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => ((stderr += String(chunk)), true)) as typeof process.stderr.write;
  try {
    const code = await main(args, env);
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
}

describe("media:process CLI", () => {
  it("requires exactly one of --dry-run or --out", () => {
    assert.throws(() => parseArgs(["./x"]), UsageError);
    assert.throws(() => parseArgs(["./x", "--dry-run", "--out", "y"]), UsageError);
    assert.throws(() => parseArgs(["--dry-run"]), /Missing input/);
    assert.throws(() => parseArgs(["./x", "--dry-run", "--upload"]), /Unknown option --upload/);
    assert.deepEqual(parseArgs(["./x", "--dry-run", "--strict"]), {
      input: "./x", mode: "dry-run", outDir: null, setId: undefined, mediaId: undefined, posters: true, json: false, strict: true,
    });
  });

  it("dry run: prints PASS/WARN, exits 0, writes nothing", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "lobby.glb": glbFrom(triangleGltf()),
      "lobby.poster.webp": webp(1280, 720, { lossless: false }),
      "terrace.jpg": jpeg(4096, 2048),
    });
    const before = await readdir(dir);
    const { code, stdout } = await cli([dir, "--dry-run"]);
    assert.equal(code, 0);
    assert.match(stdout, /DRY RUN \(nothing written, nothing uploaded\)/);
    assert.match(stdout, /^PASS {2}lobby\.glb/m);
    assert.match(stdout, /^WARN {2}terrace\.jpg/m);
    assert.match(stdout, /Result: WARN \(exit 0\)/);
    assert.deepEqual(await readdir(dir), before);
  });

  it("exits 1 on hard validation failures and with --strict on warnings", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "bad.jpg": jpeg(4000, 3000) });
    const failed = await cli([dir, "--dry-run"]);
    assert.equal(failed.code, 1);
    assert.match(failed.stdout, /^FAIL {2}bad\.jpg/m);
    assert.match(failed.stdout, /FAIL {2}panorama\.aspect-ratio/);

    const warnDir = await tempDir();
    await writeFiles(warnDir, { "pano.jpg": jpeg(4096, 2048) });
    assert.equal((await cli([warnDir, "--dry-run"])).code, 0);
    assert.equal((await cli([warnDir, "--dry-run", "--strict"])).code, 1);
  });

  it("exits 2 on usage errors", async () => {
    assert.equal((await cli(["--dry-run"])).code, 2);
    assert.equal((await cli(["/no/such/path", "--dry-run"])).code, 2);
  });

  it("--json prints the manifest on stdout and the report on stderr", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "lobby.glb": glbFrom(triangleGltf()) });
    const { code, stdout, stderr } = await cli([dir, "--dry-run", "--json", "--set-id", "demo"]);
    assert.equal(code, 0);
    const manifest = JSON.parse(stdout) as { setId: string; items: Array<{ storageKey: string }> };
    assert.equal(manifest.setId, "demo");
    assert.match(manifest.items[0].storageKey, /^m\//);
    assert.match(stderr, /Result: WARN/);
  });

  it("--out stages objects under their keys write-once, and never on failure", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "lobby.glb": glbFrom(triangleGltf()) });
    const out = join(await tempDir(), "staging");
    const first = await cli([dir, "--out", out]);
    assert.equal(first.code, 0, first.stdout);
    const manifest = JSON.parse(await readFile(join(out, "manifest.json"), "utf8")) as {
      items: Array<{ objects: Array<{ key: string; sha256: string }> }>;
    };
    const [object] = manifest.items[0].objects;
    const stagedBytes = await readFile(join(out, "objects", ...object.key.split("/")));
    assert.deepEqual(new Uint8Array(stagedBytes), glbFrom(triangleGltf()));

    const second = await cli([dir, "--out", out]);
    assert.match(second.stdout, /Staged 0 new object\(s\), 1 already present/);

    await writeFile(join(out, "objects", ...object.key.split("/")), "tampered");
    const tampered = await cli([dir, "--out", out]);
    assert.equal(tampered.code, 1);
    assert.match(tampered.stdout, /Write-once violation/);

    const badDir = await tempDir();
    await writeFiles(badDir, { "bad.jpg": jpeg(10, 10) });
    const badOut = join(await tempDir(), "staging");
    const bad = await cli([badDir, "--out", badOut]);
    assert.equal(bad.code, 1);
    assert.match(bad.stdout, /Nothing staged because validation failed/);
    await assert.rejects(readdir(badOut));
  });

  it("refuses a staging directory that contains unrelated files", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "lobby.glb": glbFrom(triangleGltf()) });
    const out = await tempDir();
    await writeFile(join(out, "notes.txt"), "keep me");
    const { code, stdout } = await cli([dir, "--out", out]);
    assert.equal(code, 1);
    assert.match(stdout, /unrelated files/);
  });
});

describe("pipeline isolation", () => {
  it("contains no AWS SDK, network or upload code", async () => {
    const root = join(__dirname, "..", "..", "..", "..", "src", "pipeline");
    for (const name of await readdir(root)) {
      const source = await readFile(join(root, name), "utf8");
      for (const forbidden of [/@aws-sdk/, /aws-cdk-lib/, /\bfetch\(/, /node:https?\b/, /from "https?"/, /XMLHttpRequest/, /PutObjectCommand/]) {
        assert.ok(!forbidden.test(source), `${name} matches ${forbidden}`);
      }
    }
  });
});
