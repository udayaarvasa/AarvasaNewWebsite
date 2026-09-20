/**
 * Development-only Gaussian splat test scene, served as a real SOG v2 bundle by
 * src/app/labs/splats/[file]/route.ts (404 in production). It is generated from
 * code, deterministically: an abstract grey ground disc, a hollow orange
 * "placeholder" tower outline and three axis markers (+X red, +Y green, +Z
 * blue) that make orientation checkable by eye. It depicts no real place, and
 * no binary is committed.
 *
 * Pure (no sharp, no DOM): this module produces the SOG textures as raw RGBA and
 * the ZIP container; the route encodes the textures as lossless WebP.
 */

export const SPLAT_FIXTURES = {
  "test-scene": { name: "Test scan" },
} as const;

export type SplatFixture = keyof typeof SPLAT_FIXTURES;

export const SPLAT_FIXTURE_PATH = "/labs/splats";

export function isSplatFixture(name: string): name is SplatFixture {
  return Object.prototype.hasOwnProperty.call(SPLAT_FIXTURES, name);
}

export function splatFixtureUrl(name: SplatFixture): string {
  return `${SPLAT_FIXTURE_PATH}/${name}.sog`;
}

type Splat = { x: number; y: number; z: number; sigma: number; r: number; g: number; b: number; opacity: number };

/** The scene, in PlayCanvas units (Y up, metres-ish). */
export function testSceneSplats(): Splat[] {
  const splats: Splat[] = [];
  // Ground disc, radius 3, a two-tone checker so motion and scale are visible.
  const step = 0.1;
  for (let x = -3; x <= 3 + 1e-9; x += step) {
    for (let z = -3; z <= 3 + 1e-9; z += step) {
      if (x * x + z * z > 9) continue;
      const light = (Math.floor(x + 3) + Math.floor(z + 3)) % 2 === 0;
      const v = light ? 0.62 : 0.42;
      splats.push({ x, y: 0, z, sigma: 0.06, r: v, g: v, b: v, opacity: 0.95 });
    }
  }
  // Tower outline: 12 edges of a 1 × 2.5 × 1 box on the disc's centre.
  const corners = [-0.5, 0.5];
  const edge = (from: [number, number, number], to: [number, number, number]) => {
    const n = Math.max(2, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) / 0.04));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      splats.push({ x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t, z: from[2] + (to[2] - from[2]) * t, sigma: 0.035, r: 0.95, g: 0.55, b: 0.15, opacity: 1 });
    }
  };
  for (const a of corners) {
    for (const b of corners) {
      edge([a, 0, b], [a, 2.5, b]);
      for (const y of [0, 2.5]) {
        edge([a, y, -0.5], [a, y, 0.5]);
        edge([-0.5, y, a], [0.5, y, a]);
      }
    }
  }
  // Axis markers from (−2, 0.05, −2) outwards, so they sit clear of the tower.
  const origin = [-2, 0.05, -2] as const;
  const axes: [[number, number, number], [number, number, number]][] = [
    [[1, 0, 0], [0.9, 0.1, 0.1]],
    [[0, 1, 0], [0.1, 0.85, 0.2]],
    [[0, 0, 1], [0.15, 0.3, 0.95]],
  ];
  for (const [d, [r, g, b]] of axes) {
    for (let i = 0; i <= 25; i++) {
      const t = (i / 25) * 1.2;
      splats.push({ x: origin[0] + d[0] * t, y: origin[1] + d[1] * t, z: origin[2] + d[2] * t, sigma: 0.04, r, g, b, opacity: 1 });
    }
  }
  return splats;
}

export type SogTexture = { name: string; width: number; height: number; rgba: Uint8Array };
export type SogScene = { meta: Record<string, unknown>; textures: SogTexture[]; count: number };

const SH_C0 = 0.28209479177387814;
const TEXTURE_WIDTH = 64;
const logPosition = (v: number) => Math.sign(v) * Math.log(Math.abs(v) + 1);
const linspace = (a: number, b: number) => Array.from({ length: 256 }, (_, i) => a + ((b - a) * i) / 255);
const nearest = (book: number[], v: number) => {
  let best = 0;
  for (let i = 1; i < book.length; i++) if (Math.abs(book[i] - v) < Math.abs(book[best] - v)) best = i;
  return best;
};

/**
 * Encodes splats as SOG v2 (the layout PlayCanvas 2.22.2 decodes in
 * gsplat-sog-data.js and the SOG shader chunk): 16-bit log-space positions split
 * into means_l/means_u, smallest-three quaternions (identity here), and 256-entry
 * codebooks for log scale and base colour.
 */
export function encodeSog(splats: Splat[]): SogScene {
  const count = splats.length;
  const height = Math.ceil(count / TEXTURE_WIDTH);
  const texture = (name: string): SogTexture => ({ name, width: TEXTURE_WIDTH, height, rgba: new Uint8Array(TEXTURE_WIDTH * height * 4) });
  const [meansL, meansU, quats, scales, sh0] = ["means_l.webp", "means_u.webp", "quats.webp", "scales.webp", "sh0.webp"].map(texture);

  const logs = splats.map((s) => [logPosition(s.x), logPosition(s.y), logPosition(s.z)]);
  const mins = [0, 1, 2].map((a) => Math.min(...logs.map((l) => l[a])));
  const maxs = [0, 1, 2].map((a) => Math.max(...logs.map((l) => l[a])));
  const scaleBook = linspace(Math.log(0.005), Math.log(0.3));
  const colorBook = linspace(-2, 2);

  splats.forEach((s, i) => {
    const o = i * 4;
    for (let a = 0; a < 3; a++) {
      const range = maxs[a] - mins[a] || 1;
      const q = Math.round(((logs[i][a] - mins[a]) / range) * 65535);
      meansL.rgba[o + a] = q & 0xff;
      meansU.rgba[o + a] = q >> 8;
    }
    meansL.rgba[o + 3] = meansU.rgba[o + 3] = 255;
    // Identity rotation: the omitted (largest) component is w, the others 0 (byte 128).
    quats.rgba.set([128, 128, 128, 252], o);
    const scaleIndex = nearest(scaleBook, Math.log(s.sigma));
    scales.rgba.set([scaleIndex, scaleIndex, scaleIndex, 255], o);
    sh0.rgba.set([nearest(colorBook, (s.r - 0.5) / SH_C0), nearest(colorBook, (s.g - 0.5) / SH_C0), nearest(colorBook, (s.b - 0.5) / SH_C0), Math.round(s.opacity * 255)], o);
  });

  const meta = {
    version: 2,
    count,
    means: { mins, maxs, files: ["means_l.webp", "means_u.webp"] },
    scales: { codebook: scaleBook, files: ["scales.webp"] },
    quats: { files: ["quats.webp"] },
    sh0: { codebook: colorBook, files: ["sh0.webp"] },
  };
  return { meta, textures: [meansL, meansU, quats, scales, sh0], count };
}

// ── ZIP (stored, no compression) ────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP of stored entries, with no archive comment (PlayCanvas reads the end record at the very end). */
export function storedZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    parts.push(local, data);
    central.push(cd);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Builds the full .sog bundle, given a lossless WebP encoder for RGBA textures. */
export async function buildTestSog(encodeWebp: (texture: SogTexture) => Promise<Uint8Array>): Promise<Uint8Array> {
  const scene = encodeSog(testSceneSplats());
  const entries: { name: string; data: Uint8Array }[] = [{ name: "meta.json", data: new TextEncoder().encode(JSON.stringify(scene.meta)) }];
  for (const texture of scene.textures) entries.push({ name: texture.name, data: await encodeWebp(texture) });
  return storedZip(entries);
}
