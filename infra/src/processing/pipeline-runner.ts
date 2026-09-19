import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PosterGenerator } from "../pipeline/adapters";
import { processAssets, type ItemManifest, type SetManifest, type StagedObject } from "../pipeline/process";

export interface PipelineRun {
  readonly manifest: SetManifest;
  readonly item: ItemManifest;
  readonly staged: readonly StagedObject[];
}

/**
 * Runs the Phase 2B-2 pipeline (processAssets, unchanged) on one verified source.
 * The pipeline reads files, so the bytes go to a private temporary directory
 * (mkdtemp: owner-only) named only by the server-derived extension, and are
 * removed afterwards whatever happens. setId and mediaId are the asset id, so the
 * manifest and every key are deterministic for the same bytes and generator.
 */
export async function runPipelineOnSource(
  bytes: Uint8Array,
  options: { readonly mediaId: string; readonly extension: string; readonly posterGenerator: PosterGenerator | null },
): Promise<PipelineRun> {
  if (!/^[a-z0-9]{2,5}$/.test(options.extension)) throw new Error("Invalid source extension");
  const dir = await mkdtemp(join(tmpdir(), "aarvasa-processing-"));
  try {
    const file = join(dir, `source.${options.extension}`);
    await writeFile(file, bytes, { mode: 0o600, flag: "wx" });
    const { manifest, staged } = await processAssets(file, { mediaId: options.mediaId, setId: options.mediaId, posterGenerator: options.posterGenerator });
    if (manifest.items.length !== 1) throw new Error("The pipeline must return exactly one item for one source");
    return { manifest, item: manifest.items[0], staged };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
