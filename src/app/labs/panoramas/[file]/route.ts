import { isPanoramaFixture, PANORAMA_FIXTURE_SIZE, PANORAMA_FIXTURES, type PanoramaFixture } from "@/lib/viewer/panorama-fixtures";

/**
 * Development-only test panoramas for the 360° tour pilot. Each is an abstract,
 * deterministic 2:1 grid generated in memory: 30° yaw/pitch lines, compass
 * headings and a "Test room — placeholder" label. It depicts no real place,
 * takes no input beyond a fixed fixture name, and never fetches anything.
 * Returns 404 in production builds.
 */
const { width: W, height: H } = PANORAMA_FIXTURE_SIZE;

const x = (yawDeg: number) => (0.5 + yawDeg / 360) * W;
const y = (pitchDeg: number) => (0.5 - pitchDeg / 180) * H;

function fixtureSvg(fixture: PanoramaFixture): string {
  const { name, hue } = PANORAMA_FIXTURES[fixture];
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="hsl(${hue} 35% 22%)"/>`);
  // Floor and ceiling bands, so up and down are obvious.
  parts.push(`<rect y="${y(-30)}" width="${W}" height="${H - y(-30)}" fill="hsl(${hue} 25% 14%)"/>`);
  parts.push(`<rect width="${W}" height="${y(60)}" fill="hsl(${hue} 30% 32%)"/>`);
  for (let yaw = -180; yaw <= 180; yaw += 30) {
    const major = yaw % 90 === 0;
    parts.push(`<line x1="${x(yaw)}" y1="0" x2="${x(yaw)}" y2="${H}" stroke="hsl(${hue} 60% ${major ? 75 : 55}%)" stroke-width="${major ? 4 : 2}"/>`);
  }
  for (let pitch = -60; pitch <= 60; pitch += 30) {
    parts.push(`<line x1="0" y1="${y(pitch)}" x2="${W}" y2="${y(pitch)}" stroke="hsl(${hue} 60% ${pitch === 0 ? 75 : 55}%)" stroke-width="${pitch === 0 ? 4 : 2}"/>`);
  }
  const headings: [number, string][] = [[0, "0° FRONT"], [90, "90° RIGHT"], [180, "180° BACK"], [-90, "−90° LEFT"], [-180, "180° BACK"]];
  for (const [yaw, text] of headings) {
    const anchor = yaw === -180 ? "start" : yaw === 180 ? "end" : "middle";
    parts.push(`<text x="${x(yaw) + (yaw === -180 ? 12 : yaw === 180 ? -12 : 0)}" y="${y(4)}" font-family="sans-serif" font-size="36" font-weight="700" fill="white" text-anchor="${anchor}">${text}</text>`);
  }
  for (const yaw of [-150, -120, -60, -30, 30, 60, 120, 150]) {
    parts.push(`<text x="${x(yaw)}" y="${y(4)}" font-family="sans-serif" font-size="24" fill="white" fill-opacity="0.8" text-anchor="middle">${yaw}°</text>`);
  }
  for (const yaw of [0, 90, -90, 180]) {
    const at = `x="${yaw === 180 ? x(180) - 12 : x(yaw)}" text-anchor="${yaw === 180 ? "end" : "middle"}" font-family="sans-serif" fill="white"`;
    parts.push(`<text ${at} y="${y(-16)}" font-size="44" font-weight="800">${name.toUpperCase()}</text>`);
    parts.push(`<text ${at} y="${y(-24)}" font-size="26" font-weight="600" fill-opacity="0.85">PLACEHOLDER</text>`);
  }
  parts.push(`<text x="${x(0)}" y="${y(40)}" font-family="sans-serif" font-size="28" fill="white" fill-opacity="0.85" text-anchor="middle">UP ↑ · generated test image · not a real property</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

const cache = new Map<PanoramaFixture, Uint8Array>();

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { file } = await params;
  const name = file.endsWith(".jpg") ? file.slice(0, -".jpg".length) : "";
  if (!isPanoramaFixture(name)) return new Response("Not found", { status: 404 });

  let bytes = cache.get(name);
  if (!bytes) {
    const { default: sharp } = await import("sharp");
    bytes = new Uint8Array(await sharp(Buffer.from(fixtureSvg(name))).jpeg({ quality: 82 }).toBuffer());
    cache.set(name, bytes);
  }
  return new Response(bytes.slice(), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
