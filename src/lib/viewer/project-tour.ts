import type { Project, ProjectTourScene } from "../project-types";
import { MEDIA_CDN_ORIGIN } from "./media-origin";
import { isPanoramaFixture, PANORAMA_FIXTURES, panoramaFixtureUrl } from "./panorama-fixtures";
import type { PublishedPanorama } from "./published-panoramas";
import { DEFAULT_PANORAMA_VIEW, sanitizeTour, type SanitizedTour } from "./tour";

/**
 * Maps a project's tour configuration to the public tour the viewer shows.
 *
 * Publication gating happens here, on the server, never in the browser:
 *
 * - a "published" scene is shown only if its MediaAsset is in `published`,
 *   which holds nothing but PUBLISHED panoramas of this project
 *   (src/lib/viewer/published-panoramas.ts); its URL is built from the asset's
 *   published key and this build's media CDN origin, never from project data;
 * - "fixture" scenes and "placeholder" tours never reach production builds;
 * - scenes that cannot be shown are dropped, and so are hotspots leading to
 *   them (sanitizeTour), so the visitor never meets a dead end.
 *
 * Server-safe: no PlayCanvas, no browser APIs, no database access.
 */
export function projectTourConfig(
  project: Pick<Project, "name" | "tour">,
  published: ReadonlyMap<string, PublishedPanorama>,
  { nodeEnv = process.env.NODE_ENV, cdnOrigin = MEDIA_CDN_ORIGIN }: { nodeEnv?: string; cdnOrigin?: string | null } = {},
): SanitizedTour {
  const config = project.tour;
  if (!config) return { tour: null, problems: [] };
  const production = nodeEnv === "production";
  if (config.review !== "approved" && production) return { tour: null, problems: ["placeholder tours are not shown in production"] };
  // Production has no media origin yet; development uses the DEV media CDN.
  const origin = production ? null : cdnOrigin;

  const problems: string[] = [];
  const scenes = config.scenes.flatMap((scene) => {
    const image = sceneImage(scene, published, origin, production);
    if (typeof image === "string") {
      problems.push(`scene "${scene.id}": ${image}`);
      return [];
    }
    return [
      {
        id: scene.id,
        title: scene.title,
        floor: scene.floor,
        imageUrl: image.url,
        alt: scene.alt ?? image.alt,
        initialView: { ...DEFAULT_PANORAMA_VIEW, ...image.initialView, ...scene.initialView },
        hotspots: scene.hotspots,
      },
    ];
  });

  const result = sanitizeTour(
    {
      label: config.review === "placeholder" ? `${config.label} (placeholder)` : config.label,
      startSceneId: config.startSceneId,
      placeholder: config.review === "placeholder",
      scenes,
    },
    origin ? [origin] : [],
  );
  return { tour: result.tour, problems: [...problems, ...result.problems] };
}

type SceneImage = { url: string; alt: string | undefined; initialView: object | null };

/** The image a scene may show in this build, or why it cannot be shown. */
function sceneImage(
  scene: ProjectTourScene,
  published: ReadonlyMap<string, PublishedPanorama>,
  origin: string | null,
  production: boolean,
): SceneImage | string {
  const image = scene.image;
  if (image.source === "fixture") {
    if (production) return "test fixtures are not shown in production";
    if (!isPanoramaFixture(image.fixture)) return "unknown fixture";
    const alt = `${PANORAMA_FIXTURES[image.fixture].name}: a generated 360° test grid with compass headings, not a real place.`;
    return { url: panoramaFixtureUrl(image.fixture), alt, initialView: null };
  }
  if (image.source === "published") {
    const asset = published.get(image.mediaAssetId);
    if (!asset) return "media asset is not a published panorama of this project";
    if (!origin) return "no media origin in this build";
    return { url: `${origin}/${asset.entryKey}`, alt: asset.altText, initialView: asset.initialView };
  }
  return "unknown image source";
}

/** MediaAsset ids a project's tour references; the only ones the server looks up. */
export function tourMediaAssetIds(project: Pick<Project, "tour">): string[] {
  const ids = project.tour?.scenes.flatMap((s) => (s.image.source === "published" ? [s.image.mediaAssetId] : [])) ?? [];
  return [...new Set(ids)];
}
