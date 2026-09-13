import { BYTE_BUDGETS, SPLAT_GAUSSIAN_BUDGET } from "../media-budgets";
import { checkCountBudget } from "./budget-checks";
import type { Findings } from "./findings";
import { readWebp } from "./formats";
import { readZipDirectory, readZipEntry, ZipError, type ZipEntry } from "./zip";

export interface SplatMetrics {
  readonly gaussians: number;
  readonly metaVersion: 1 | 2;
  readonly shBands: number | null;
  readonly files: number;
  readonly uncompressedBytes: number;
  /** Too large for a single-file delivery; should move to streamed SOG (future). */
  readonly streamingCandidate: boolean;
}

const MAX_ENTRIES = 64;
const SAFE_ENTRY_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;
/** An archive can never expand beyond this, whatever its entries declare. */
const MAX_UNCOMPRESSED_BYTES = 4 * BYTE_BUDGETS.SPLAT.hardLimit;
const SECTIONS = ["means", "scales", "quats", "sh0", "shN"] as const;
/** shN centroid texture width → SH bands, per the published SOG format. */
const BANDS_BY_CENTROID_WIDTH: Readonly<Record<number, number>> = { 96: 1, 512: 2, 960: 3 };

type Json = Record<string, unknown>;
const record = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);

/**
 * Validates a bundled SOG (.sog ZIP) against the format PlayCanvas 2.22.2 loads:
 * meta.json (v2, or v1 which the engine upgrades) plus lossless WebP attribute images.
 */
export function validateSog(bytes: Uint8Array, findings: Findings): SplatMetrics | null {
  let entries: ZipEntry[];
  try {
    entries = readZipDirectory(bytes);
  } catch (error) {
    findings.fail("sog.zip", `Not a readable SOG bundle: ${(error as Error).message}`);
    return null;
  }

  // ── Archive hygiene ────────────────────────────────────────────────────────
  let hygieneOk = true;
  if (entries.length === 0 || entries.length > MAX_ENTRIES) {
    findings.fail("sog.entries", `Archive has ${entries.length} entries; expected 1–${MAX_ENTRIES}`);
    return null;
  }
  const names = new Set<string>();
  let declaredTotal = 0;
  for (const entry of entries) {
    if (!SAFE_ENTRY_NAME.test(entry.name)) {
      findings.fail("sog.entries", `Unsafe or nested entry name ${JSON.stringify(entry.name.slice(0, 80))}; SOG bundles are flat`);
      hygieneOk = false;
    }
    if (names.has(entry.name)) {
      findings.fail("sog.entries", `Duplicate entry ${entry.name}`);
      hygieneOk = false;
    }
    names.add(entry.name);
    if (entry.flags & 0x1) {
      findings.fail("sog.entries", `${entry.name} is encrypted`);
      hygieneOk = false;
    }
    declaredTotal += entry.uncompressedSize;
  }
  if (declaredTotal > MAX_UNCOMPRESSED_BYTES) {
    findings.fail("sog.zip-bomb", `Entries declare ${declaredTotal} uncompressed bytes; the limit is ${MAX_UNCOMPRESSED_BYTES}`);
    return null;
  }
  if (!hygieneOk) return null;
  findings.pass("sog.entries", `${entries.length} flat entries, ${declaredTotal} B uncompressed`);

  const readEntry = (entry: ZipEntry): Uint8Array | null => {
    try {
      return readZipEntry(bytes, entry);
    } catch (error) {
      findings.fail("sog.zip", error instanceof ZipError ? error.message : String(error));
      return null;
    }
  };

  // ── meta.json ──────────────────────────────────────────────────────────────
  const metaEntry = entries.find((e) => e.name === "meta.json");
  if (!metaEntry) {
    findings.fail("sog.meta", "meta.json not found in the bundle");
    return null;
  }
  const metaBytes = readEntry(metaEntry);
  if (!metaBytes) return null;
  let meta: Json | null;
  try {
    meta = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(metaBytes)));
  } catch (error) {
    findings.fail("sog.meta", `meta.json is not valid JSON: ${(error as Error).message}`);
    return null;
  }
  if (!meta) {
    findings.fail("sog.meta", "meta.json is not an object");
    return null;
  }

  const metaVersion: 1 | 2 = meta.version === 2 ? 2 : 1;
  const shape = record(meta.means)?.shape;
  const rawCount = metaVersion === 2 ? meta.count : Array.isArray(shape) ? shape[0] : undefined;
  const gaussians = typeof rawCount === "number" && Number.isInteger(rawCount) && rawCount > 0 ? rawCount : 0;
  if (!gaussians) {
    findings.fail("sog.meta", `meta.json v${metaVersion} has no valid gaussian count`);
    return null;
  }

  const referenced = new Map<string, string>();
  for (const section of SECTIONS) {
    const files = record(meta[section])?.files;
    if (files === undefined) {
      if (section !== "shN") {
        findings.fail("sog.meta", `meta.json is missing the required "${section}" section`);
        return null;
      }
      continue;
    }
    if (!Array.isArray(files) || files.length === 0 || !files.every((f): f is string => typeof f === "string")) {
      findings.fail("sog.meta", `meta.json "${section}.files" must be a non-empty list of file names`);
      return null;
    }
    for (const file of files) referenced.set(file, section);
  }
  findings.pass("sog.meta", `meta.json v${metaVersion}: ${gaussians.toLocaleString("en-US")} gaussians`);

  // ── Referenced files: present, lossless WebP; nothing else smuggled in ─────
  let filesOk = true;
  for (const file of referenced.keys()) {
    if (!names.has(file)) {
      findings.fail("sog.files", `meta.json references ${file}, which is not in the bundle`);
      filesOk = false;
    }
  }
  const unreferenced = [...names].filter((n) => n !== "meta.json" && !referenced.has(n));
  if (unreferenced.length > 0) {
    findings.fail("sog.files", `Bundle contains files meta.json does not reference: ${unreferenced.join(", ")}`);
    filesOk = false;
  }

  let uncompressedBytes = metaBytes.length;
  let shBands: number | null = referenced.size > 0 && ![...referenced.values()].includes("shN") ? 0 : null;
  const declaredBands = record(meta.shN)?.bands;
  if (typeof declaredBands === "number") shBands = declaredBands;

  for (const entry of entries) {
    if (entry.name === "meta.json" || !referenced.has(entry.name)) continue;
    const data = readEntry(entry);
    if (!data) {
      filesOk = false;
      continue;
    }
    uncompressedBytes += data.length;
    const webp = readWebp(data);
    if (!webp) {
      findings.fail("sog.webp", `${entry.name} is not a readable WebP image`);
      filesOk = false;
    } else if (!webp.lossless || webp.animated) {
      findings.fail("sog.webp", `${entry.name} must be a still, lossless WebP (lossy encoding corrupts quantised splat data)`);
      filesOk = false;
    } else if (shBands === null && entry.name.includes("centroids")) {
      shBands = BANDS_BY_CENTROID_WIDTH[webp.width] ?? null;
    }
  }
  if (filesOk) findings.pass("sog.files", `${referenced.size} referenced lossless WebP file(s), no unreferenced files`);
  else return null;

  const streamingByCount = gaussians > SPLAT_GAUSSIAN_BUDGET.desktopTarget;
  const streamingBySize = bytes.length > BYTE_BUDGETS.SPLAT.desktopTarget;
  checkCountBudget(findings, "sog.gaussians", "Gaussian count", gaussians, SPLAT_GAUSSIAN_BUDGET, "; flag for streamed SOG delivery (future)");
  if (streamingByCount || streamingBySize) {
    findings.warn("sog.streaming-candidate", "Scene is above the single-file desktop target; plan streamed SOG (LOD) delivery in a later phase");
  }

  return {
    gaussians,
    metaVersion,
    shBands,
    files: entries.length,
    uncompressedBytes,
    streamingCandidate: streamingByCount || streamingBySize,
  };
}
