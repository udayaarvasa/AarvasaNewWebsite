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

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
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
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": metadata.contentType,
          "Cache-Control": metadata.cacheControl,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // Not in this staged set; try the next one.
    }
  }
  return notFound("Run `npm run media:pilot:stage` to stage the pilot media.");
}
