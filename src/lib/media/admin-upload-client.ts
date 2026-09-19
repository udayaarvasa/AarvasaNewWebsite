import { MEDIA_FORMAT_SPECS, SINGLE_PUT_UPLOAD_MAX_BYTES, SOURCE_MAX_BYTES, type MediaAssetFormat } from "../../../shared/media-asset";

/**
 * Browser-side admin upload flow (Phase 5), transport-agnostic so it can be tested
 * without a browser:
 *
 *   hash file (SHA-256) → POST /api/media/upload-intent → PUT bytes directly to S3
 *   (presigned; the file never passes through Next.js) → POST /api/media/{id}/complete
 *
 * The browser supplies only what the intent API accepts (subject, format, filename,
 * size, declared type, SHA-256, title, alt text). Keys, status, checksum binding and
 * ownership are decided server-side. No credentials exist here: only the one
 * presigned URL and the exact headers it was signed with.
 */

export type UploadTarget = { readonly subjectType: "PROPERTY"; readonly propertyId: string } | { readonly subjectType: "PROJECT"; readonly projectSlug: string };

export interface UploadFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type UploadStage = "hashing" | "authorizing" | "uploading" | "completing" | "done";

export interface UploadTransport {
  /** Same-origin JSON request (cookies included by the browser). */
  fetchJson(url: string, init: { readonly method: "POST"; readonly body: unknown }): Promise<{ readonly status: number; readonly body: unknown }>;
  /** PUT the file to the presigned URL with exactly these headers, reporting progress. */
  put(url: string, headers: Readonly<Record<string, string>>, file: UploadFile, onProgress: (loaded: number, total: number) => void): Promise<{ readonly status: number }>;
  digestSha256(data: ArrayBuffer): Promise<ArrayBuffer>;
  sleep(ms: number): Promise<void>;
}

export class AdminUploadError extends Error {
  override readonly name = "AdminUploadError";
  constructor(
    message: string,
    readonly stage: UploadStage,
  ) {
    super(message);
  }
}

export interface AdminUploadInput {
  readonly target: UploadTarget;
  readonly format: MediaAssetFormat;
  readonly file: UploadFile;
  readonly title?: string;
  readonly altText?: string;
}

export interface AdminUploadResult {
  readonly mediaAssetId: string;
  readonly status: string;
}

/** Friendly pre-checks; the server enforces the same rules authoritatively. */
export function checkUploadFile(format: MediaAssetFormat, file: Pick<UploadFile, "name" | "size">): string | null {
  const spec = MEDIA_FORMAT_SPECS[format];
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  if (!spec.filenameExtensions.includes(extension)) return `Choose a .${spec.filenameExtensions.join(" or .")} file for this format.`;
  if (file.size <= 0) return "The file is empty.";
  const limit = Math.min(SOURCE_MAX_BYTES[spec.kind], SINGLE_PUT_UPLOAD_MAX_BYTES);
  if (file.size > limit) return `The file is larger than ${limit / 1_000_000} MB.`;
  return null;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** A readable message from the APIs' { error } shape (a string, or validation issues). */
export function apiErrorMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error) return error;
  if (Array.isArray(error)) {
    const messages = error.map((e) => (e as { message?: unknown })?.message).filter((m): m is string => typeof m === "string");
    if (messages.length > 0) return messages.join("; ");
  }
  return fallback;
}

const COMPLETE_ATTEMPTS = 4;

export async function runAdminUpload(
  input: AdminUploadInput,
  transport: UploadTransport,
  onStage: (stage: UploadStage, progress?: number) => void = () => undefined,
): Promise<AdminUploadResult> {
  const spec = MEDIA_FORMAT_SPECS[input.format];
  const problem = checkUploadFile(input.format, input.file);
  if (problem) throw new AdminUploadError(problem, "hashing");

  onStage("hashing");
  const sha256 = toBase64(await transport.digestSha256(await input.file.arrayBuffer()));

  onStage("authorizing");
  const declaredType = input.file.type.toLowerCase();
  const intentBody = {
    ...input.target,
    kind: spec.kind,
    expectedFormat: input.format,
    filename: input.file.name,
    sourceSizeBytes: input.file.size,
    ...(declaredType && spec.clientMimeTypes.includes(declaredType) ? { sourceMimeType: declaredType } : {}),
    sha256,
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
    ...(input.altText?.trim() ? { altText: input.altText.trim() } : {}),
  };
  const intent = await transport.fetchJson("/api/media/upload-intent", { method: "POST", body: intentBody });
  if (intent.status !== 201) throw new AdminUploadError(apiErrorMessage(intent.body, "The upload could not be authorised."), "authorizing");
  const data = (intent.body as { data?: { mediaAssetId?: unknown; upload?: { url?: unknown; headers?: unknown } } }).data;
  const mediaAssetId = typeof data?.mediaAssetId === "string" ? data.mediaAssetId : null;
  const url = typeof data?.upload?.url === "string" ? data.upload.url : null;
  const headers = data?.upload?.headers && typeof data.upload.headers === "object" ? (data.upload.headers as Record<string, string>) : null;
  if (!mediaAssetId || !url || !headers) throw new AdminUploadError("The upload could not be authorised.", "authorizing");

  onStage("uploading", 0);
  const put = await transport.put(url, headers, input.file, (loaded, total) => onStage("uploading", total > 0 ? loaded / total : 0));
  if (put.status < 200 || put.status >= 300) throw new AdminUploadError("The file could not be uploaded to storage. Please try again.", "uploading");

  onStage("completing");
  for (let attempt = 1; ; attempt++) {
    const completed = await transport.fetchJson(`/api/media/${encodeURIComponent(mediaAssetId)}/complete`, { method: "POST", body: {} });
    const body = completed.body as { data?: { status?: unknown }; code?: unknown; retryable?: unknown };
    if (completed.status === 200) {
      onStage("done");
      return { mediaAssetId, status: typeof body.data?.status === "string" ? body.data.status : "PROCESSING" };
    }
    const retryable = body.retryable === true && (body.code === "UPLOAD_NOT_FOUND" || body.code === "VERIFICATION_UNAVAILABLE");
    if (!retryable || attempt >= COMPLETE_ATTEMPTS) throw new AdminUploadError(apiErrorMessage(completed.body, "The upload could not be verified."), "completing");
    await transport.sleep(1000 * attempt);
  }
}
