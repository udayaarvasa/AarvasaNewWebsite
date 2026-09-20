/**
 * Development-only test panoramas, generated on request by
 * src/app/labs/panoramas/[file]/route.ts (404 in production). They are abstract
 * grids with compass headings and a "test room — placeholder" label: they
 * depict no real property, and no image file is committed.
 *
 * The headings make orientation checkable by eye: yaw 0 is the image centre,
 * so a hotspot at yaw 90 must sit on the 90° line.
 */
export const PANORAMA_FIXTURES = {
  "test-room-a": { name: "Test room A", hue: 205 },
  "test-room-b": { name: "Test room B", hue: 150 },
  "test-room-c": { name: "Test room C", hue: 30 },
} as const;

export type PanoramaFixture = keyof typeof PANORAMA_FIXTURES;

export const PANORAMA_FIXTURE_PATH = "/labs/panoramas";
export const PANORAMA_FIXTURE_SIZE = { width: 2048, height: 1024 } as const;

export function isPanoramaFixture(name: string): name is PanoramaFixture {
  return Object.prototype.hasOwnProperty.call(PANORAMA_FIXTURES, name);
}

export function panoramaFixtureUrl(name: PanoramaFixture): string {
  return `${PANORAMA_FIXTURE_PATH}/${name}.jpg`;
}
