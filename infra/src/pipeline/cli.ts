#!/usr/bin/env node
/**
 * Local, offline media pipeline. Validates assets and produces a manifest of
 * immutable object keys. It never uploads, never calls AWS and never modifies
 * the source files.
 *
 *   npm run media:process -- <file-or-directory> --dry-run
 *   npm run media:process -- <file-or-directory> --out <staging-dir>
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { formatBytes } from "../media-budgets";
import { loadSharpPosterGenerator } from "./adapters";
import type { Level } from "./findings";
import { processAssets, PIPELINE_VERSION, PROCESSING_PROFILE, type ProcessResult, UsageError } from "./process";

const USAGE = `Usage: npm run media:process -- <file-or-directory> (--dry-run | --out <dir>) [options]

Modes (exactly one):
  --dry-run            Validate and report. Writes nothing.
  --out <dir>          Also stage objects/<key> files and manifest.json locally (write-once).

Options:
  --set-id <id>        Listing/set identifier (default: directory name). Seeds derived media ids.
  --media-id <id>      Explicit media id (single file only; 8–40 lowercase letters/digits).
  --no-posters         Do not generate panorama posters (sidecar posters are still used).
  --json               Print the manifest JSON to stdout (report goes to stderr).
  --strict             Treat warnings as failures (exit 1).
  -h, --help           Show this help.

Exit codes: 0 = pass (warnings allowed), 1 = validation failure, 2 = usage or input error.
Nothing is ever uploaded. No AWS credentials are used.`;

export interface CliArgs {
  readonly input: string;
  readonly mode: "dry-run" | "out";
  readonly outDir: string | null;
  readonly setId?: string;
  readonly mediaId?: string;
  readonly posters: boolean;
  readonly json: boolean;
  readonly strict: boolean;
}

export function parseArgs(argv: readonly string[]): CliArgs | "help" {
  let input: string | undefined;
  let dryRun = false;
  let outDir: string | null = null;
  let setId: string | undefined;
  let mediaId: string | undefined;
  let posters = true;
  let json = false;
  let strict = false;

  const value = (i: number, flag: string) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        return "help";
      case "--dry-run":
        dryRun = true;
        break;
      case "--out":
        outDir = value(i++, arg);
        break;
      case "--set-id":
        setId = value(i++, arg);
        break;
      case "--media-id":
        mediaId = value(i++, arg);
        break;
      case "--no-posters":
        posters = false;
        break;
      case "--json":
        json = true;
        break;
      case "--strict":
        strict = true;
        break;
      default:
        if (arg.startsWith("-")) throw new UsageError(`Unknown option ${arg}`);
        if (input !== undefined) throw new UsageError("Only one input path is accepted");
        input = arg;
    }
  }
  if (!input) throw new UsageError("Missing input path");
  if (dryRun === (outDir !== null)) throw new UsageError("Choose exactly one of --dry-run or --out <dir>");
  return { input, mode: dryRun ? "dry-run" : "out", outDir, setId, mediaId, posters, json, strict };
}

const LABEL: Record<Level, string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };

export function renderReport(result: ProcessResult, args: CliArgs, exitCode: number): string {
  const { manifest } = result;
  const lines: string[] = [];
  const modeText = args.mode === "dry-run" ? "DRY RUN (nothing written, nothing uploaded)" : `STAGING to ${args.outDir} (local only, nothing uploaded)`;
  lines.push(`Aarvasa media pipeline v${PIPELINE_VERSION} · profile ${PROCESSING_PROFILE} · ${modeText}`);
  lines.push(`Set "${manifest.setId}" · ${manifest.items.length} item(s) · posters: ${manifest.pipeline.posterGenerator ?? "sidecar only"}`);
  lines.push("");
  for (const item of manifest.items) {
    const what = item.kind ? `${item.kind}${item.format ? `/${item.format}` : ""}` : "unrecognised";
    lines.push(`${LABEL[item.status]}  ${item.source.filename}  ·  ${what}  ·  ${formatBytes(item.source.sizeBytes)}`);
    for (const object of item.objects) lines.push(`      ${object.role.padEnd(6)} ${object.key}  (${object.contentType})`);
    for (const finding of item.validation) lines.push(`      ${LABEL[finding.level]}  ${finding.rule.padEnd(26)} ${finding.message}`);
    lines.push("");
  }
  lines.push("Set checks");
  for (const finding of manifest.validation) lines.push(`      ${LABEL[finding.level]}  ${finding.rule.padEnd(26)} ${finding.message}`);
  lines.push("");
  const t = manifest.totals;
  lines.push(
    `Summary: ${t.pass} PASS, ${t.warn} WARN, ${t.fail} FAIL · published ${formatBytes(t.publishedBytes)} · initial view ${formatBytes(t.initialViewBytes)}${manifest.reviewRequired ? " · REVIEW REQUIRED" : ""}`,
  );
  lines.push(`Result: ${LABEL[manifest.status]} (exit ${exitCode})`);
  return lines.join("\n");
}

const sha256File = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex");

/** Writes objects/<key> and manifest.json. Existing identical objects are kept; different bytes are refused. */
export async function stage(result: ProcessResult, outDir: string): Promise<{ written: number; existing: number }> {
  const objectsRoot = join(outDir, "objects");
  let written = 0;
  let existing = 0;
  for (const object of result.staged) {
    const target = join(objectsRoot, ...object.key.split("/"));
    if (relative(objectsRoot, target).startsWith("..")) throw new Error(`Refusing to stage outside ${objectsRoot}: ${object.key}`);
    let currentHash: string | null = null;
    try {
      currentHash = await sha256File(target);
    } catch {
      currentHash = null;
    }
    if (currentHash !== null) {
      if (currentHash !== object.sha256) throw new Error(`Write-once violation: ${object.key} already exists with different bytes`);
      existing++;
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.partial`;
    if (object.sourcePath) await copyFile(object.sourcePath, temp);
    else if (object.bytes) await writeFile(temp, object.bytes);
    else throw new Error(`No bytes for ${object.key}`);
    if ((await sha256File(temp)) !== object.sha256) throw new Error(`Staged bytes for ${object.key} do not match the manifest hash`);
    await rename(temp, target);
    written++;
  }
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(result.manifest, null, 2)}\n`);
  return { written, existing };
}

export async function main(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<number> {
  let args: CliArgs | "help";
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}\n`);
    return 2;
  }
  if (args === "help") {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  // `npm --prefix infra run` changes directory; resolve paths against where the user ran npm.
  const base = env.INIT_CWD ?? process.cwd();
  const input = isAbsolute(args.input) ? args.input : resolve(base, args.input);
  const outDir = args.outDir === null ? null : isAbsolute(args.outDir) ? args.outDir : resolve(base, args.outDir);

  let result: ProcessResult;
  try {
    result = await processAssets(input, {
      setId: args.setId,
      mediaId: args.mediaId,
      posterGenerator: args.posters ? loadSharpPosterGenerator(env) : null,
    });
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    throw error;
  }

  const failed = result.manifest.status === "fail" || (args.strict && result.manifest.status === "warn");
  const exitCode = failed ? 1 : 0;
  const report = renderReport(result, { ...args, outDir }, exitCode);
  const reportStream = args.json ? process.stderr : process.stdout;

  if (outDir && !failed) {
    try {
      const entries = await readdir(outDir).catch(() => [] as string[]);
      if (entries.some((e) => e !== "objects" && e !== "manifest.json")) {
        throw new Error(`${outDir} contains unrelated files; use an empty staging directory`);
      }
      const { written, existing } = await stage(result, outDir);
      reportStream.write(`${report}\nStaged ${written} new object(s), ${existing} already present, manifest at ${join(outDir, "manifest.json")}\n`);
    } catch (error) {
      reportStream.write(`${report}\nStaging failed: ${(error as Error).message}\n`);
      return 1;
    }
  } else {
    const note = outDir && failed ? "\nNothing staged because validation failed." : "";
    reportStream.write(`${report}${note}\n`);
  }
  if (args.json) process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
  return exitCode;
}

if (require.main === module) {
  main(process.argv.slice(2), process.env).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`Unexpected error: ${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 2;
    },
  );
}
