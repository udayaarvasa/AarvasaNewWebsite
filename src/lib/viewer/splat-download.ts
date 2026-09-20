/**
 * Capped download of a SOG bundle. Pure apart from `fetch` (injectable for
 * tests): no PlayCanvas, no DOM.
 */

/** The media CDN and the dev fixture both serve .sog as application/zip (shared/media-contract.ts). */
export const SOG_CONTENT_TYPE = "application/zip";

/** A failure whose message is safe and useful to show the visitor. */
export class SplatLoadError extends Error {
  constructor(
    readonly kind: "http" | "too-large" | "format",
    message: string,
  ) {
    super(message);
    this.name = "SplatLoadError";
  }
}

const TOO_LARGE = "This 3D scan is too large to open on this device.";

/**
 * Downloads the bundle without credentials, refusing anything that is not a
 * SOG or is larger than `maxBytes`: a declared Content-Length over the cap
 * stops before the body is read, and an undeclared or understated one stops as
 * soon as the running total passes it. `signal` aborts the request.
 */
export async function downloadSog(url: string, signal: AbortSignal, maxBytes: number, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const response = await fetchImpl(url, { signal, credentials: "omit" });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new SplatLoadError("http", `The 3D scan failed to load (HTTP ${response.status})`);
  }
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== SOG_CONTENT_TYPE) {
    await response.body?.cancel().catch(() => {});
    throw new SplatLoadError("format", "The 3D scan is not a SOG bundle");
  }
  const declared = Number(response.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new SplatLoadError("too-large", TOO_LARGE);
  }
  if (!response.body) {
    const whole = new Uint8Array(await response.arrayBuffer());
    if (whole.byteLength > maxBytes) throw new SplatLoadError("too-large", TOO_LARGE);
    return whole;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new SplatLoadError("too-large", TOO_LARGE);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
