import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { publishedObjectMetadata } from "../../../../../shared/media-contract";

/**
 * Development-only stand-in for the media CDN. Serves objects staged by
 * `npm run media:pilot:stage` under the same keys (m/{mediaId}/{keyHash}/…) and
 * headers the CDN will use, so pages can exercise real manifest data locally.
 * Returns 404 in production builds and never reads outside media-pilot/.staging.
 */
const STAGING_ROOT = join(process.cwd(), "media-pilot", ".staging");

const notFound = (hint: string) =>
  new Response(`Not found. ${hint}`, { status: 404, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } });

/**
 * One byte range from a Range header, as CloudFront honours it, or null.
 *
 * The real CDN answers `Range` with 206 and a Content-Range. Without the same
 * here a browser treats a film as unseekable — choosing a chapter jumped to
 * the end — so the stand-in was not standing in for the CDN at all.
 */
function byteRange(header: string | null, total: number): { start: number; end: number } | "unsatisfiable" | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]); // bytes=-N: the last N bytes
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= total) return "unsatisfiable";
  return { start, end };
}

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  const { key: segments } = await params;
  const key = segments.join("/");
  // The storage contract rejects traversal, unknown types and anything outside m/.
  const metadata = key.startsWith("m/") ? publishedObjectMetadata(key) : null;
  if (!metadata) return notFound("Not a valid published media key.");

  const sets = await readdir(STAGING_ROOT).catch(() => [] as string[]);
  for (const set of sets) {
    try {
      const bytes = await readFile(join(STAGING_ROOT, set, "objects", ...segments));
      const base = {
        "Content-Type": metadata.contentType,
        "Cache-Control": metadata.cacheControl,
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
      };
      const range = byteRange(request.headers.get("range"), bytes.length);
      if (range === "unsatisfiable") {
        return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${bytes.length}` } });
      }
      if (range) {
        return new Response(new Uint8Array(bytes.subarray(range.start, range.end + 1)), {
          status: 206,
          headers: { ...base, "Content-Range": `bytes ${range.start}-${range.end}/${bytes.length}` },
        });
      }
      return new Response(new Uint8Array(bytes), { headers: base });
    } catch {
      // Not in this staged set; try the next one.
    }
  }
  return notFound("Run `npm run media:pilot:stage` to stage the pilot media.");
}
