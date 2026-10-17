import { prisma } from "@/lib/prisma";
import type { Project } from "@/lib/project-types";
import { MEDIA_CDN_ORIGIN } from "@/lib/viewer/media-origin";
import { publishedVideosQuery, toPublishedVideo, type PublishedVideo } from "@/lib/viewer/published-videos";
import { boundFilmIds, resolveImmersiveTour, tourForProject, type ResolvedTourScene } from "@/lib/immersive-tours";

/**
 * Server-only: a project's Immersive Tour, or null.
 *
 * Every film comes through the media resolver — PUBLISHED, VIDEO, this project's,
 * PUBLIC unless `includeInternal` — and nothing else. There is no fallback to a
 * local file and no URL in the catalogue to fall back to: a tour whose films
 * have not been through the pipeline is a tour that is not available, and the
 * page says so.
 *
 * `includeInternal` is for the admin preview only, behind its role check.
 */
export async function loadImmersiveTour(
  project: Project,
  options: { includeInternal?: boolean } = {},
): Promise<ResolvedTourScene[] | null> {
  if (!MEDIA_CDN_ORIGIN) return null;
  const catalogue = tourForProject(project.slug);
  if (!catalogue) return null;
  // No film published yet: nothing to look up, and no reason to touch the database.
  const ids = boundFilmIds(catalogue);
  if (ids.length === 0) return null;
  try {
    const rows = await prisma.mediaAsset.findMany(publishedVideosQuery(project.slug, options));
    const byId = new Map<string, PublishedVideo>();
    for (const row of rows) {
      const video = toPublishedVideo(row, project.slug, MEDIA_CDN_ORIGIN, options);
      if (video) byId.set(video.mediaId, video);
    }
    return resolveImmersiveTour(catalogue, byId);
  } catch {
    // Media must never break a project page.
    console.error(`[immersive-tour] could not load published films for ${project.slug}`);
    return null;
  }
}
