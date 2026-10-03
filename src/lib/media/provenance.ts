/**
 * How a piece of immersive media was produced, and what that permits.
 *
 * Two separate jobs, both of which have to be got right.
 *
 * 1. Public labelling. A render and a photograph are identical to a validator —
 *    the same pixels, the same magic bytes — so provenance is declared by the
 *    person uploading and confirmed by the reviewer, never inferred. Captioning
 *    a render as a photograph of a building that does not exist yet is the
 *    failure this prevents.
 *
 * 2. Whether an asset may be shown publicly at all. INTERNAL_TEST is
 *    engineering material: a 952-byte cube used to prove the pipeline end to
 *    end is not a model of a tower in Dubai, and must never reach a property
 *    page, a listing card, a capability mark or production.
 *
 * Pure: no Prisma, no I/O, so the rules are asserted directly by tests. The
 * values mirror the MediaProvenance enum in prisma/schema.prisma.
 */

export const MEDIA_PROVENANCE = [
  "OFFICIAL_MODEL",
  "DEVELOPER_RENDER",
  "SHOW_APARTMENT_PHOTO",
  "PHOTO_360",
  "RENDERED_360",
  "AARVASA_RECONSTRUCTION",
  "INTERNAL_TEST",
] as const;

export type MediaProvenance = (typeof MEDIA_PROVENANCE)[number];

/**
 * The only value that is not publicly showable.
 *
 * Expressed as a deny-list of one rather than an allow-list on purpose: adding
 * a new genuine provenance should not silently make it invisible, whereas a new
 * *test* category must be added here consciously.
 */
const PRIVATE_PROVENANCE: ReadonlySet<string> = new Set<MediaProvenance>(["INTERNAL_TEST"]);

export const isMediaProvenance = (value: unknown): value is MediaProvenance =>
  typeof value === "string" && (MEDIA_PROVENANCE as readonly string[]).includes(value);

/**
 * May an asset with this provenance be shown to the public?
 *
 * Anything unrecognised is refused. A row carrying a value this build does not
 * know about is not evidence that it is safe to publish.
 */
export function isPubliclyShowable(provenance: unknown): boolean {
  return isMediaProvenance(provenance) && !PRIVATE_PROVENANCE.has(provenance);
}

/** Shown to visitors beside the media. Never softened, never omitted. */
export const PROVENANCE_LABEL: Readonly<Record<MediaProvenance, string>> = {
  OFFICIAL_MODEL: "Official developer model",
  DEVELOPER_RENDER: "Developer render",
  SHOW_APARTMENT_PHOTO: "Show apartment photograph",
  PHOTO_360: "360° photograph",
  RENDERED_360: "360° rendered from a 3D model",
  AARVASA_RECONSTRUCTION: "Aarvasa reconstruction",
  INTERNAL_TEST: "Internal test asset",
};

/**
 * The longer note a project page can show under the label, where the short form
 * would leave a visitor with the wrong impression.
 */
export const PROVENANCE_NOTE: Readonly<Partial<Record<MediaProvenance, string>>> = {
  DEVELOPER_RENDER: "A render supplied by the developer, not a photograph of a completed building.",
  SHOW_APARTMENT_PHOTO:
    "A photograph of a furnished demonstration unit, not of a delivered residence.",
  RENDERED_360: "Rendered from a 3D model, not photographed on site.",
  AARVASA_RECONSTRUCTION:
    "Reconstructed by Aarvasa from photographs or video. Not an official developer model.",
  INTERNAL_TEST: "Engineering test asset. Not a model of this project.",
};

/**
 * Which provenance values make sense for each kind of asset.
 *
 * A MODEL cannot be a 360 photograph and a PANORAMA cannot be an official
 * building model, so the upload boundary rejects the combination rather than
 * storing a claim that contradicts itself.
 */
export const PROVENANCE_BY_KIND: Readonly<Record<"MODEL" | "PANORAMA" | "SPLAT", readonly MediaProvenance[]>> = {
  MODEL: ["OFFICIAL_MODEL", "DEVELOPER_RENDER", "AARVASA_RECONSTRUCTION", "INTERNAL_TEST"],
  PANORAMA: ["PHOTO_360", "RENDERED_360", "SHOW_APARTMENT_PHOTO", "INTERNAL_TEST"],
  SPLAT: ["AARVASA_RECONSTRUCTION", "INTERNAL_TEST"],
};

export function provenanceAllowedFor(kind: string, provenance: unknown): boolean {
  if (!isMediaProvenance(provenance)) return false;
  const allowed = PROVENANCE_BY_KIND[kind as keyof typeof PROVENANCE_BY_KIND];
  return allowed !== undefined && allowed.includes(provenance);
}
