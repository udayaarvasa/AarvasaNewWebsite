import { buildTestSog, isSplatFixture, type SogTexture, type SplatFixture } from "@/lib/viewer/splat-fixtures";

/**
 * Development-only Gaussian splat test scene (a real SOG v2 bundle generated
 * from code; see src/lib/viewer/splat-fixtures.ts). It depicts no real place,
 * takes no input beyond a fixed fixture name, and never fetches anything.
 * Returns 404 in production builds.
 */
const cache = new Map<SplatFixture, Uint8Array>();

async function encodeWebp(texture: SogTexture): Promise<Uint8Array> {
  const { default: sharp } = await import("sharp");
  const raw = { width: texture.width, height: texture.height, channels: 4 as const };
  // Lossless, so quantised splat data survives byte for byte. Every splat's texel has
  // non-zero alpha; only the padding past the last splat is transparent, and it is never read.
  return new Uint8Array(await sharp(Buffer.from(texture.rgba), { raw }).webp({ lossless: true }).toBuffer());
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { file } = await params;
  const name = file.endsWith(".sog") ? file.slice(0, -".sog".length) : "";
  if (!isSplatFixture(name)) return new Response("Not found", { status: 404 });

  let bytes = cache.get(name);
  if (!bytes) {
    bytes = await buildTestSog(encodeWebp);
    cache.set(name, bytes);
  }
  return new Response(bytes.slice(), {
    headers: { "Content-Type": "application/zip", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
