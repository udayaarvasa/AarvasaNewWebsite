import type { MediaProvenance } from "./media/provenance";
import type { ModelView } from "./viewer/types";

import type { CurrencyCode } from "./currency";

/** One purchasable configuration — an apartment layout, or a plot size. */
export type ProjectUnitType = {
  /** Machine key, e.g. "STUDIO" or "22X35". */
  type: string;
  /** Buyer-facing label, e.g. "Studio" or "22 × 35 ft". */
  label: string;
  bedrooms: number;
  /** Units currently released. null when the developer has not disclosed counts. */
  available: number | null;
  minSqft: number;
  maxSqft: number;
  fromPrice: number;
  toPrice: number;
};

export type ProjectPaymentPlan = {
  name: string;
  downPayment: string;
  duringConstruction: string;
  final: string;
  note: string | null;
};

/**
 * An immersive asset for a project, in the shape the media pipeline's manifest
 * publishes (`npm run media:process`, Phase 2B-2). It holds object keys only,
 * never URLs: where keys are served from is environment configuration, resolved
 * in src/lib/viewer/project-media.ts.
 */
export type ProjectImmersiveMedia = {
  mediaId: string;
  kind: "MODEL";
  format: "GLB";
  /** Immutable version directory, m/{mediaId}/{keyHash}. */
  storageKey: string;
  /** Entry file inside storageKey, e.g. "scene.glb". */
  entryFile: string;
  /** SHA-256 of the entry file. */
  contentHash: string;
  sizeBytes: number;
  poster: { key: string; width: number; height: number } | null;
  processingVersion: string;
  /** What the model shows, for screen readers. */
  altText: string;
  /**
   * "placeholder": a pipeline test asset that does not depict the project, only
   * ever shown outside production builds. "approved": reviewed real media.
   */
  review: "placeholder" | "approved";
  /**
   * How the model was produced, for the label shown beside it. Carried from the
   * MediaAsset row; absent on the hand-authored pilot, which `review` already
   * marks as a placeholder.
   */
  provenance?: MediaProvenance;
  /**
   * Where the camera opens on this model. Absent uses the generic object
   * framing, which suits something seen whole; a tower needs to open closer or
   * its facade is too small to read before the visitor zooms.
   */
  view?: ModelView;
  /** Where it opens on a narrow viewer, where the same camera has far fewer pixels. */
  mobileView?: ModelView;
  /**
   * Optional XR opt-in (Phase 8). A model is shown in 3D whether or not it is
   * offered in AR or VR: each mode must be listed here, and the project must
   * state the model's scale, which is never inferred from the geometry.
   */
  xr?: {
    modes: ("ar" | "vr")[];
    /** Metres per model unit (1 = the GLB is in metres) and the AR preview factor (1 = life size). */
    scale?: { metersPerUnit: number; previewScale: number };
  };
};

/**
 * Where a tour scene's panorama comes from. "published" names a MediaAsset
 * (kind PANORAMA) of this project; it is only shown once that asset is
 * PUBLISHED. "fixture" is a generated development test image
 * (src/lib/viewer/panorama-fixtures.ts), never shown in production.
 */
export type ProjectTourImage =
  | { source: "published"; mediaAssetId: string }
  | { source: "fixture"; fixture: string };

/** One room of a project's 360° tour. Hotspots use the viewer's tour shape (src/lib/viewer/tour.ts). */
export type ProjectTourScene = {
  id: string;
  title: string;
  floor?: string;
  image: ProjectTourImage;
  /** Screen-reader description. Published assets fall back to their reviewed alt text. */
  alt?: string;
  /** Opening direction. Published assets fall back to their reviewed view defaults. */
  initialView?: { yawDeg: number; pitchDeg: number; fovDeg: number };
  hotspots: {
    id: string;
    label: string;
    yawDeg: number;
    pitchDeg: number;
    type?: "navigation" | "info";
    targetSceneId?: string;
    description?: string;
  }[];
};

/** A project's 360° panoramic tour. Mapped for the viewer in src/lib/viewer/project-tour.ts. */
export type ProjectPanoramaTour = {
  label: string;
  /** Same meaning as ProjectImmersiveMedia.review: "placeholder" tours never reach production. */
  review: "placeholder" | "approved";
  startSceneId: string;
  scenes: ProjectTourScene[];
};

/**
 * A project's Gaussian splat scene (Phase 7). "published" names a MediaAsset
 * (kind SPLAT, format SOG) of this project, shown only once it is PUBLISHED;
 * "fixture" is the generated development test scene
 * (src/lib/viewer/splat-fixtures.ts), never shown in production.
 * Mapped for the viewer in src/lib/viewer/project-splat.ts.
 */
export type ProjectSplatMedia = {
  label: string;
  /** Same meaning as ProjectImmersiveMedia.review: "placeholder" scenes never reach production. */
  review: "placeholder" | "approved";
  scene: { source: "published"; mediaAssetId: string } | { source: "fixture"; fixture: string };
  /** Screen-reader description. Published assets fall back to their reviewed alt text. */
  alt?: string;
  /** "y-down" for captures still in the original 3DGS/COLMAP frame. Default "y-up". */
  upAxis?: "y-up" | "y-down";
  /** Opening orbit; distance is a multiple of the scene's bounding radius. */
  initialView?: { yawDeg: number; pitchDeg: number; distanceFactor: number };
};

export type Project = {
  slug: string;
  name: string;
  developer: string;
  location: string;
  city: string;
  country: string;
  currency: CurrencyCode;
  /** Drives which detail sections render. */
  kind: "apartments" | "plots";
  /** Handover or possession. null for ready/undisclosed. */
  completion: string | null;
  totalUnits: number | null;
  buildingConfig: string | null;
  availableUnits: number | null;
  fromPrice: number;
  toPrice: number;
  minSqft: number;
  maxSqft: number;
  /** Headline rate, e.g. 3500 for plots sold per sq.ft. null when priced per unit. */
  ratePerSqft: number | null;
  /** Extra pricing detail where a single rate understates it (tiered plot rates). */
  rateNote: string | null;
  /**
   * Whether the project is live on the site. Explicit rather than inferred from
   * imagery: a project can be worth publishing on its facts alone, with a
   * typographic panel standing in for a photo it does not yet have.
   */
  published: boolean;
  unitTypes: ProjectUnitType[];
  views: string[];
  images: string[];
  /** Layout/site plan — rendered separately from photography so the two are never conflated. */
  planImages: string[];
  planLabels: string[];
  paymentPlans: ProjectPaymentPlan[];
  nearby: { place: string; minutes: number | null }[];
  usps: string[];
  /** Regulatory approvals, e.g. "T&CP Approved Layout". */
  approvals: string[];
  contact: string[];
  coordinates: { lat: number; lng: number } | null;
  /**
   * How precisely `coordinates` is known, and where it came from.
   *
   * The distinction decides what the coordinate may be used for. "locality"
   * means it lands in the right community and is good enough to show someone
   * the surroundings; it is NOT good enough to place a building model on a plot,
   * which would put a tower on whatever happens to be at that point. "plot"
   * means the position was established for the building itself.
   */
  coordinatesPrecision?: "plot" | "locality";
  /** Where the coordinate came from, for anyone re-checking it later. */
  coordinatesSource?: string;
  /** Optional interactive 3D media. Absent for most projects. */
  immersive?: ProjectImmersiveMedia;
  /** Optional 360° panoramic tour. Absent for most projects. */
  tour?: ProjectPanoramaTour;
  /** Optional Gaussian splat scene. Absent for most projects. */
  splat?: ProjectSplatMedia;
  /**
   * Optional curated imagery, attached where a project has a properly reviewed
   * image library rather than the one or two frames `images` carries. Each
   * entry states how it was produced, so an off-plan render is never shown as
   * a photograph. See src/lib/reef-996-imagery.ts.
   */
  imagery?: ProjectImagery;
};

/** How an image was produced. Stated per image, never inferred from its subject. */
export type ProjectImageOrigin = "photo" | "render";

export type ProjectImageRatio = "16x9" | "4x5" | "3x2" | "1x1";

export type ProjectCuratedImage = {
  readonly id: string;
  /** Public directory holding this image's crops, e.g. "/images/reef-996/hero". */
  readonly dir: string;
  readonly ratios: readonly ProjectImageRatio[];
  readonly alt: string;
  readonly caption: string;
  readonly origin: ProjectImageOrigin;
};

/** Images grouped by the job they do on the site, so each surface gets a different frame. */
export type ProjectImagery = {
  readonly hero: ProjectCuratedImage;
  readonly gallery: readonly ProjectCuratedImage[];
  readonly cards: readonly ProjectCuratedImage[];
  readonly details: readonly ProjectCuratedImage[];
  readonly banners: readonly ProjectCuratedImage[];
};

/**
 * Path to a generated crop. Ratios are fixed when the library is built, so a
 * ratio the image does not have falls back to its first rather than 404ing.
 */
export function projectImageSrc(
  image: ProjectCuratedImage,
  ratio: ProjectImageRatio,
): string {
  const r = image.ratios.includes(ratio) ? ratio : image.ratios[0];
  return `${image.dir}/${image.id}-${r}.jpg`;
}
