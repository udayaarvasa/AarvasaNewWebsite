/**
 * Panorama geometry shared by the PlayCanvas mesh, the look controls and the
 * hotspot projection. Pure numbers, no PlayCanvas, so it is unit-tested in Node.
 *
 * Convention: yaw 0 looks down −Z at the centre of the equirectangular image,
 * positive yaw turns right (towards +X), positive pitch looks up (+Y).
 */

const DEG = Math.PI / 180;

/** Touch devices get a smaller texture: an 8192 × 4096 RGBA panorama is 128 MB of GPU memory. */
export const MAX_PANORAMA_WIDTH_DESKTOP = 8192;
export const MAX_PANORAMA_WIDTH_TOUCH = 4096;
const ASPECT_TOLERANCE = 0.02;

/** Unit direction [x, y, z] for a heading. */
export function directionVector(yawDeg: number, pitchDeg: number): [number, number, number] {
  const yaw = yawDeg * DEG;
  const pitch = pitchDeg * DEG;
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

/** Inverse of `directionVector`: yaw in (−180, 180], pitch in [−90, 90]. */
export function headingOf([x, y, z]: readonly [number, number, number]): { yawDeg: number; pitchDeg: number } {
  const length = Math.hypot(x, y, z) || 1;
  return { yawDeg: Math.atan2(x, -z) / DEG, pitchDeg: Math.asin(Math.max(-1, Math.min(1, y / length))) / DEG };
}

/**
 * Texture coordinates for a heading, with v = 0 at the image's top row: u runs
 * from the left edge (yaw −180°) through the centre (yaw 0°) to the right edge
 * (yaw 180°); v runs from the top (pitch 90°) to the bottom (pitch −90°).
 */
export function equirectUv(yawDeg: number, pitchDeg: number): [number, number] {
  return [0.5 + yawDeg / 360, 0.5 - pitchDeg / 180];
}

/** True for an equirectangular image: twice as wide as it is tall (small rounding allowed). */
export function isEquirectangular(width: number, height: number): boolean {
  return width > 0 && height > 0 && Math.abs(width / height - 2) <= 2 * ASPECT_TOLERANCE;
}

/** Widest texture this device should hold: the GPU limit, capped lower on touch-first devices. */
export function maxPanoramaWidth(maxTextureSize: number, coarsePointer: boolean): number {
  return Math.min(maxTextureSize, coarsePointer ? MAX_PANORAMA_WIDTH_TOUCH : MAX_PANORAMA_WIDTH_DESKTOP);
}
