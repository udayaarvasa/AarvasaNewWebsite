/**
 * Upload-boundary validation for 3D models.
 *
 * Runs before a file is accepted for processing, and again server-side on the
 * bytes that actually arrived — the browser's reported MIME type and the file
 * extension are both attacker-controlled and neither is consulted for the
 * decision. Identity comes from the magic bytes.
 *
 * Pure: no I/O, no Prisma, so the rules below are asserted directly by tests.
 *
 * Only GLB and glTF are accepted, because those are what the processing
 * pipeline actually handles. FBX and OBJ are refused rather than accepted and
 * failed later.
 */

export const MODEL_LIMITS = {
  /** Anything smaller cannot contain a valid header plus a JSON chunk. */
  minBytes: 20,
  /** 256 MB. Larger models are rejected before they occupy the ingest bucket. */
  maxBytes: 256 * 1024 * 1024,
  /** glTF binary container version this pipeline supports. */
  supportedVersion: 2,
} as const;

export type ModelRejection =
  | "EMPTY_FILE"
  | "TOO_LARGE"
  | "TOO_SMALL"
  | "NOT_A_MODEL"
  | "UNSUPPORTED_VERSION"
  | "MALFORMED_HEADER"
  | "EXTERNAL_REFERENCES";

export const MODEL_REJECTION_MESSAGES: Readonly<Record<ModelRejection, string>> = {
  EMPTY_FILE: "That file is empty.",
  TOO_LARGE: "That model is larger than 256 MB. Export it again with compressed textures.",
  TOO_SMALL: "That file is too small to be a 3D model.",
  NOT_A_MODEL:
    "That is not a GLB or glTF file. FBX and OBJ are not supported — export to GLB and try again.",
  UNSUPPORTED_VERSION: "That file uses an older glTF version. Export it as glTF 2.0.",
  MALFORMED_HEADER: "That file looks damaged. Export it again and re-upload.",
  EXTERNAL_REFERENCES:
    "That glTF points at files stored elsewhere. Export it as a single self-contained .glb so every texture travels with the model.",
};

export type ModelKind = "glb" | "gltf-json";

export type ModelValidation =
  | { readonly ok: true; readonly kind: ModelKind; readonly sizeBytes: number }
  | { readonly ok: false; readonly rejection: ModelRejection; readonly message: string };

const fail = (rejection: ModelRejection): ModelValidation => ({
  ok: false,
  rejection,
  message: MODEL_REJECTION_MESSAGES[rejection],
});

const u32 = (b: Uint8Array, at: number): number =>
  b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24);

/**
 * Does a glTF JSON document reference anything outside itself?
 *
 * A .gltf is JSON that may point at textures and buffers by URI. A remote URI
 * would make the processing worker fetch an attacker-chosen address from inside
 * our network, and a relative one would arrive broken because only this single
 * file was uploaded. Data URIs are self-contained and fine.
 */
export function hasExternalReferences(json: string): boolean {
  // Deliberately lexical rather than parsed: the check must hold even for
  // documents this validator would otherwise fail to parse.
  const uris = json.matchAll(/"uri"\s*:\s*"([^"]*)"/g);
  for (const [, uri] of uris) {
    if (!uri) continue;
    if (uri.startsWith("data:")) continue;
    return true;
  }
  return false;
}

/** Validate the bytes actually received. `bytes` may be a prefix for a cheap pre-check. */
export function validateModelBytes(bytes: Uint8Array, declaredSize: number): ModelValidation {
  if (declaredSize === 0 || bytes.length === 0) return fail("EMPTY_FILE");
  if (declaredSize > MODEL_LIMITS.maxBytes) return fail("TOO_LARGE");
  if (declaredSize < MODEL_LIMITS.minBytes) return fail("TOO_SMALL");

  // "glTF" — the binary container.
  const isGlb =
    bytes.length >= 12 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46;

  if (isGlb) {
    const version = u32(bytes, 4);
    if (version !== MODEL_LIMITS.supportedVersion) return fail("UNSUPPORTED_VERSION");
    const declaredLength = u32(bytes, 8);
    // The header's own length must agree with the file we were given.
    if (declaredLength !== declaredSize) return fail("MALFORMED_HEADER");
    return { ok: true, kind: "glb", sizeBytes: declaredSize };
  }

  // A .gltf document is JSON carrying an "asset" block.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.length, 65536)))
    .trimStart();

  if (head.startsWith("{") && head.includes('"asset"')) {
    if (hasExternalReferences(head)) return fail("EXTERNAL_REFERENCES");
    return { ok: true, kind: "gltf-json", sizeBytes: declaredSize };
  }

  return fail("NOT_A_MODEL");
}

/** Content types the upload endpoint will issue a signed URL for. */
export const ACCEPTED_MODEL_MIME = [
  "model/gltf-binary",
  "model/gltf+json",
  "application/octet-stream",
] as const;

/** File-picker hint only. Never the basis of a decision. */
export const ACCEPTED_MODEL_EXTENSIONS = [".glb", ".gltf"] as const;
