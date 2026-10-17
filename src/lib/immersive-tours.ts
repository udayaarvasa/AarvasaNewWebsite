/* Explicit .ts specifiers: the app test runner loads this under node's ESM
   resolver. See published-videos.ts. */
import { PROVENANCE_LABEL } from "./media/provenance.ts";
import type { PublishedVideo } from "./viewer/published-videos.ts";

/**
 * Immersive Tours: REEF's own films, cut into the spaces they show.
 *
 * NOT 360. Every film here is an ordinary portrait video — 464x832 or 480x848,
 * no spherical metadata — and covers exactly what its camera pointed at. It is
 * presented as a film of the spaces, never as a walkthrough a visitor can look
 * around in, and it never goes near the panorama viewer.
 *
 * WHAT THIS FILE IS. The editorial catalogue: which film shows which space, and
 * when. It is the same arrangement as the 360 pilot tour in projects.ts — an
 * ordered structure in the repository, bound to PUBLISHED media by id — rather
 * than a second media database. The bytes live in the media pipeline and nowhere
 * else; this file never names a URL or a storage key.
 *
 * HOW A FILM BECOMES PLAYABLE. Each film's `mediaAssetId` is null until that film
 * has been uploaded, processed by the worker, reviewed and published. Until then
 * its scenes do not resolve and the page says the tour is not available. Setting
 * the id is the operator step that follows publication, exactly as for the
 * panorama tour.
 *
 * WHERE THE TIMES COME FROM. Contact sheets of each film, sampled every 3 s, on
 * 2026-10-04. A scene's start is the first sample it was seen in, so it is good
 * to about ±1.5 s: close enough for a chapter mark, not a frame-accurate cut.
 * The six supplied files have since been removed from where they were supplied,
 * so the times cannot be refined until the films are ingested.
 */

export const TIMESTAMP_RESOLUTION_SECONDS = 1.5;

/** Shown where a property has no playable tour. Says what is absent; never apologises. */
export const TOUR_UNAVAILABLE_MESSAGE = "Immersive tour is not yet available for this property.";
export const TOUR_UNAVAILABLE_HINT =
  "When the developer's films have been through review, they appear here, cut into the spaces they show.";

export const TOUR_CATEGORIES = [
  "EXTERIOR",
  "SUNKEN_BALCONY",
  "GYM",
  "RESIDENCE",
  "POOL",
  "LIFT_LOBBY",
  "CORRIDOR",
  "RETAIL_ARCADE",
  "BAKERY",
  "FLORIST",
  "GOURMET_GROCER",
  "AMENITY_DECK",
  "LOBBY",
  "CONSTRUCTION",
] as const;

export type TourCategory = (typeof TOUR_CATEGORIES)[number];

export const TOUR_CATEGORY_LABEL: Readonly<Record<TourCategory, string>> = {
  EXTERIOR: "Exterior",
  SUNKEN_BALCONY: "Sunken balcony",
  GYM: "Gym",
  RESIDENCE: "Residence",
  POOL: "Pool",
  LIFT_LOBBY: "Lift lobby",
  CORRIDOR: "Corridor",
  RETAIL_ARCADE: "Retail arcade",
  BAKERY: "Bakery",
  FLORIST: "Florist",
  GOURMET_GROCER: "Gourmet grocer",
  AMENITY_DECK: "Amenity deck",
  LOBBY: "Lobby",
  CONSTRUCTION: "Construction progress",
};

/** What a film is, so the visitor is told. Never a reconstruction, never 360. */
export type FilmProvenance = "DEVELOPER_RENDER" | "SITE_FOOTAGE";

export interface TourFilm {
  /** Stable within its tour. */
  readonly ref: string;
  /** The file as it was supplied, so anyone can trace a scene to its source. */
  readonly suppliedAs: string;
  /** What establishes which project it is — never the filename alone. */
  readonly identifiedBy: string;
  /** Measured with ffprobe on 2026-10-04. */
  readonly durationSeconds: number;
  readonly provenance: FilmProvenance;
  /** Null until the film has been through upload, worker, review and publish. */
  readonly mediaAssetId: string | null;
}

export interface TourScene {
  readonly ref: string;
  readonly film: string;
  readonly title: string;
  readonly category: TourCategory;
  /** 1-based, contiguous across the whole tour. */
  readonly order: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly description?: string;
  /** Where in the film the space was seen. */
  readonly evidence: string;
}

export interface ImmersiveTourCatalogue {
  readonly projectName: string;
  /**
   * The project the tour belongs to, or null when there is no project record to
   * attach it to. A tour with no project cannot be uploaded as project media and
   * has no page to appear on; inventing a record to give it one would invent the
   * project's location, price and completion date.
   */
  readonly projectSlug: string | null;
  readonly films: readonly TourFilm[];
  readonly scenes: readonly TourScene[];
}

const REEF_998: ImmersiveTourCatalogue = {
  projectName: "REEF 998",
  projectSlug: "reef-998-dlrc",
  films: [
    {
      ref: "998-film-a",
      suppliedAs: "WhatsApp Video 2026-10-04 at 17.59.50.mp4",
      identifiedBy: 'Opens on the "998" title card over the full-height exterior render',
      durationSeconds: 21,
      provenance: "DEVELOPER_RENDER",
      mediaAssetId: null,
    },
    {
      ref: "998-film-b",
      suppliedAs: "WhatsApp Video 2026-10-04 at 17.59.53.mp4",
      identifiedBy: 'Opens on the facade with "REEF 998" signage on the balcony band',
      durationSeconds: 40.7,
      provenance: "DEVELOPER_RENDER",
      mediaAssetId: null,
    },
  ],
  scenes: [
    { ref: "998-exterior", film: "998-film-a", title: "The tower", category: "EXTERIOR", order: 1, startSeconds: 0, endSeconds: 3, evidence: "t≈0 s, under the 998 title card" },
    { ref: "998-sunken-balcony", film: "998-film-a", title: "Sunken balcony", category: "SUNKEN_BALCONY", order: 2, startSeconds: 3, endSeconds: 6, evidence: 't≈3 s, captioned "The Third Building in the World with the Globally Patented Outdoor-Cooled Sunken Balcony"' },
    { ref: "998-gym", film: "998-film-a", title: "Gym", category: "GYM", order: 3, startSeconds: 6, endSeconds: 9, evidence: "t≈6 s" },
    { ref: "998-residence", film: "998-film-a", title: "Residence", category: "RESIDENCE", order: 4, startSeconds: 9, endSeconds: 12, evidence: "t≈9 s, living and dining" },
    { ref: "998-pool", film: "998-film-a", title: "Pool", category: "POOL", order: 5, startSeconds: 12, endSeconds: 15, evidence: "t≈12 s, partly behind the REEF wordmark transition — the weakest evidence in the catalogue; confirm against the ingested film" },
    { ref: "998-corridor", film: "998-film-b", title: "Corridor", category: "CORRIDOR", order: 6, startSeconds: 6, endSeconds: 9, evidence: 't≈6 s, captioned "A morning ritual."' },
    { ref: "998-lift-lobby", film: "998-film-b", title: "Lift lobby", category: "LIFT_LOBBY", order: 7, startSeconds: 9, endSeconds: 15, evidence: 't≈9–12 s, captioned "A quiet indulgence."' },
    { ref: "998-retail-arcade", film: "998-film-b", title: "Retail arcade", category: "RETAIL_ARCADE", order: 8, startSeconds: 15, endSeconds: 18, evidence: "t≈15 s escalator into the arcade; the arcade returns at t≈24 s" },
    { ref: "998-bakery", film: "998-film-b", title: "Bakery", category: "BAKERY", order: 9, startSeconds: 18, endSeconds: 21, evidence: 't≈18 s, captioned "Here, convenience is not simply offered."' },
    { ref: "998-florist", film: "998-film-b", title: "Florist", category: "FLORIST", order: 10, startSeconds: 21, endSeconds: 24, evidence: 't≈21 s, captioned "It is curated."' },
    { ref: "998-gourmet-grocer", film: "998-film-b", title: "Gourmet grocer", category: "GOURMET_GROCER", order: 11, startSeconds: 27, endSeconds: 30, evidence: "t≈27 s; the contact sheet ended at 27 s, so what follows 30 s is not catalogued" },
  ],
};

const REEF_999: ImmersiveTourCatalogue = {
  projectName: "REEF 999",
  projectSlug: null,
  films: [
    {
      ref: "999-film-a",
      suppliedAs: "WhatsApp Video 2026-10-04 at 17.55.52.mp4",
      identifiedBy: 'Opens on the "999" title card over the night exterior render',
      durationSeconds: 21,
      provenance: "DEVELOPER_RENDER",
      mediaAssetId: null,
    },
    {
      ref: "999-film-b",
      suppliedAs: "WhatsApp Video 2026-10-04 at 17.55.58.mp4",
      identifiedBy: 'Title card "REEF 999 · Project Update — August 2026 · 10%"',
      durationSeconds: 42.917,
      provenance: "SITE_FOOTAGE",
      mediaAssetId: null,
    },
  ],
  scenes: [
    { ref: "999-exterior", film: "999-film-a", title: "The tower", category: "EXTERIOR", order: 1, startSeconds: 0, endSeconds: 3, evidence: "t≈0 s, under the 999 title card" },
    { ref: "999-sunken-balcony", film: "999-film-a", title: "Sunken balcony", category: "SUNKEN_BALCONY", order: 2, startSeconds: 3, endSeconds: 6, evidence: 't≈3 s, captioned "The Globally Patented Outdoor-Cooled Sunken Balcony"' },
    { ref: "999-amenity-deck", film: "999-film-a", title: "Amenity deck", category: "AMENITY_DECK", order: 3, startSeconds: 6, endSeconds: 9, evidence: "t≈6 s, sculptural canopies at dusk" },
    { ref: "999-pool", film: "999-film-a", title: "Pool", category: "POOL", order: 4, startSeconds: 9, endSeconds: 12, evidence: "t≈9 s, aerial of the pool" },
    {
      ref: "999-construction",
      film: "999-film-b",
      title: "Construction, August 2026",
      category: "CONSTRUCTION",
      order: 5,
      startSeconds: 0,
      endSeconds: 42.917,
      description: "Ten per cent complete: foundations, column formwork and reinforcement. The building is not yet standing.",
      evidence: "Whole film; site footage from t≈6 s",
    },
  ],
};

const REEF_1000: ImmersiveTourCatalogue = {
  projectName: "REEF 1000",
  projectSlug: null,
  films: [
    {
      ref: "1000-film-a",
      suppliedAs: "WhatsApp Video 2026-10-04 at 17.54.28.mp4",
      identifiedBy: 'Opens on the "1000" title card over the night exterior render',
      durationSeconds: 21,
      provenance: "DEVELOPER_RENDER",
      mediaAssetId: null,
    },
    {
      ref: "1000-film-b",
      suppliedAs: "WhatsApp Video 2026-10-04 at 17.54.27.mp4",
      identifiedBy: 'Title card "1000 · 74%"',
      durationSeconds: 41.475,
      provenance: "SITE_FOOTAGE",
      mediaAssetId: null,
    },
  ],
  scenes: [
    { ref: "1000-exterior", film: "1000-film-a", title: "The tower", category: "EXTERIOR", order: 1, startSeconds: 0, endSeconds: 3, evidence: "t≈0 s, under the 1000 title card" },
    { ref: "1000-sunken-balcony", film: "1000-film-a", title: "Sunken balcony", category: "SUNKEN_BALCONY", order: 2, startSeconds: 3, endSeconds: 6, evidence: 't≈3 s, captioned "The First Building in the World with the Globally Patented Outdoor-Cooled Sunken Balcony"' },
    { ref: "1000-lobby", film: "1000-film-a", title: "Lobby", category: "LOBBY", order: 3, startSeconds: 6, endSeconds: 9, evidence: "t≈6 s, reception" },
    { ref: "1000-pool", film: "1000-film-a", title: "Pool", category: "POOL", order: 4, startSeconds: 9, endSeconds: 12, evidence: "t≈9 s, aerial of the pool" },
    {
      ref: "1000-construction",
      film: "1000-film-b",
      title: "Construction progress",
      category: "CONSTRUCTION",
      order: 5,
      startSeconds: 0,
      endSeconds: 41.475,
      // The film opens over two render frames before the site footage, so the
      // label on the film would otherwise describe six seconds it does not cover.
      description: "Opens over the developer's render with the progress figure, then cuts to the site at about three-quarters complete.",
      evidence: "t≈0–3 s render and 74% figure; site footage from t≈6 s",
    },
  ],
};

export const IMMERSIVE_TOURS: readonly ImmersiveTourCatalogue[] = [REEF_998, REEF_999, REEF_1000];

/** The catalogue for a project page, or null. A tour with no project never matches. */
export function tourForProject(projectSlug: string): ImmersiveTourCatalogue | null {
  return IMMERSIVE_TOURS.find((t) => t.projectSlug !== null && t.projectSlug === projectSlug) ?? null;
}

/** The ids worth looking up. Empty means no film has been published yet. */
export function boundFilmIds(catalogue: ImmersiveTourCatalogue): string[] {
  return catalogue.films.flatMap((f) => (f.mediaAssetId ? [f.mediaAssetId] : []));
}

/** What a page receives for one chapter. No ids, keys or visibility. */
export interface ResolvedTourScene {
  readonly ref: string;
  readonly title: string;
  readonly categoryLabel: string;
  readonly description: string | null;
  readonly order: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly video: {
    readonly ref: string;
    readonly url: string;
    readonly posterUrl: string | null;
    readonly mimeType: "video/mp4";
    readonly width: number;
    readonly height: number;
    readonly altText: string;
    readonly provenanceLabel: string;
    readonly provenanceNote: string | null;
  };
}

/** Seconds a published film may run short of the catalogue before its scenes are refused. */
const DURATION_TOLERANCE_SECONDS = 1;

/**
 * Bind a catalogue to the films that actually resolved, or null.
 *
 * A film whose id is unset, that did not resolve (unpublished, withheld, another
 * project's, not a video) or whose published provenance contradicts the
 * catalogue contributes no scenes. Nothing is shown in its place: a tour with
 * a gap is honest, and a tour padded with another film is not.
 */
export function resolveImmersiveTour(
  catalogue: ImmersiveTourCatalogue,
  videosById: ReadonlyMap<string, PublishedVideo>,
): ResolvedTourScene[] | null {
  const playable = new Map<string, PublishedVideo>();
  for (const film of catalogue.films) {
    if (!film.mediaAssetId) continue;
    const video = videosById.get(film.mediaAssetId);
    if (!video) continue;
    // A render bound into a site-footage slot, or the reverse, would put the
    // wrong label under the film. Refused rather than relabelled.
    if (video.provenanceLabel !== PROVENANCE_LABEL[film.provenance]) continue;
    playable.set(film.ref, video);
  }

  const scenes: ResolvedTourScene[] = [];
  for (const scene of catalogue.scenes) {
    const video = playable.get(scene.film);
    if (!video) continue;
    if (video.durationSeconds !== null && scene.startSeconds >= video.durationSeconds + DURATION_TOLERANCE_SECONDS) continue;
    scenes.push({
      ref: scene.ref,
      title: scene.title,
      categoryLabel: TOUR_CATEGORY_LABEL[scene.category],
      description: scene.description ?? null,
      order: scene.order,
      startSeconds: scene.startSeconds,
      endSeconds: scene.endSeconds,
      video: {
        ref: scene.film,
        url: video.url,
        posterUrl: video.posterUrl,
        mimeType: video.mimeType,
        width: video.width,
        height: video.height,
        altText: video.altText,
        provenanceLabel: video.provenanceLabel,
        provenanceNote: video.provenanceNote,
      },
    });
  }
  scenes.sort((a, b) => a.order - b.order);
  return scenes.length > 0 ? scenes : null;
}
