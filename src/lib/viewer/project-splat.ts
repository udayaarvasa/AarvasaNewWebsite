import type { Project } from "../project-types";
import { MEDIA_CDN_ORIGIN } from "./media-origin";
import type { PublishedSplat } from "./published-splats";
import { resolveSplatUrl, sanitizeSplatSource, SPLAT_VIEW_LIMITS } from "./source";
import { isSplatFixture, SPLAT_FIXTURES, splatFixtureUrl } from "./splat-fixtures";
import type { ViewerSource } from "./types";

/** What the project page needs to offer a splat scene. Serializable; nothing private. */
export type ProjectSplatConfig = {
  readonly label: string;
  readonly alt: string;
  readonly source: Extract<ViewerSource, { kind: "splat" }>;
  readonly poster: { readonly src: string; readonly width: number; readonly height: number; readonly alt: string } | null;
  /** True when the scene does not depict the project; the page must say so. */
  readonly placeholder: boolean;
};

// Only the path matters to the URL policy for root-relative files; any origin will do.
const POLICY_ORIGIN = "https://site.invalid";

/**
 * Maps a project's splat configuration to a public viewer descriptor, applying
 * the same publication gating as tours (src/lib/viewer/project-tour.ts):
 *
 * - "published": shown only if `published` holds that asset, which the server
 *   fills with PUBLISHED SPLAT/SOG assets of this project and nothing else
 *   (src/lib/viewer/published-splats.ts); URLs come from the published key and
 *   this build's media CDN origin, never from project data;
 * - "fixture" scenes and "placeholder" configurations never reach production.
 *
 * Server-safe: no PlayCanvas, no browser APIs, no database access.
 */
export function projectSplatConfig(
  project: Pick<Project, "name" | "splat">,
  published: PublishedSplat | null,
  { nodeEnv = process.env.NODE_ENV, cdnOrigin = MEDIA_CDN_ORIGIN }: { nodeEnv?: string; cdnOrigin?: string | null } = {},
): ProjectSplatConfig | null {
  const config = project.splat;
  if (!config) return null;
  const production = nodeEnv === "production";
  if (config.review !== "approved" && production) return null;
  const origin = production ? null : cdnOrigin;

  let url: string;
  let alt: string;
  let sizeBytes: number | null = null;
  let gaussians: number | null = null;
  let poster: ProjectSplatConfig["poster"] = null;
  let view: Partial<{ yawDeg: number; pitchDeg: number }> | null = null;

  const scene = config.scene;
  if (scene.source === "fixture") {
    if (production || !isSplatFixture(scene.fixture)) return null;
    url = splatFixtureUrl(scene.fixture);
    alt = config.alt ?? `${SPLAT_FIXTURES[scene.fixture].name}: a generated test scene (ground disc, tower outline, axis markers), not a real place.`;
  } else if (scene.source === "published") {
    if (!published || published.id !== scene.mediaAssetId || !origin) return null;
    url = `${origin}/${published.entryKey}`;
    alt = config.alt ?? published.altText;
    sizeBytes = published.sizeBytes;
    gaussians = published.gaussians;
    view = published.initialView;
    if (published.poster) poster = { src: `${origin}/${published.poster.key}`, width: published.poster.width, height: published.poster.height, alt };
  } else {
    return null;
  }

  if (!resolveSplatUrl(url, POLICY_ORIGIN, origin ? [origin] : [])) return null;
  const source = sanitizeSplatSource({
    kind: "splat",
    url,
    initialView: { ...SPLAT_VIEW_LIMITS.defaultView, ...view, ...config.initialView },
    upAxis: config.upAxis ?? "y-up",
    sizeBytes,
    gaussians,
  });
  if (!source) return null;

  const placeholder = config.review === "placeholder";
  return { label: placeholder ? `${config.label} (placeholder)` : config.label, alt, source, poster, placeholder };
}

/** The MediaAsset id a project's splat references, if any; the only one the server looks up. */
export function splatMediaAssetId(project: Pick<Project, "splat">): string | null {
  const scene = project.splat?.scene;
  return scene?.source === "published" ? scene.mediaAssetId : null;
}
