import { prisma } from "@/lib/prisma";
import type { Project } from "@/lib/project-types";
import { projectTourConfig, tourMediaAssetIds } from "@/lib/viewer/project-tour";
import { publishedPanoramaQuery, toPublishedPanoramas, type PublishedPanorama } from "@/lib/viewer/published-panoramas";
import type { PanoramaTour } from "@/lib/viewer/tour";

/**
 * Server-only: the public 360° tour for a project page, or null.
 *
 * Looks up only the MediaAsset ids the project's tour names, and only as
 * PUBLISHED panoramas of that project (publishedPanoramaQuery). A project whose
 * tour uses no published media never touches the database, which keeps static
 * builds of fixture-only or tour-less projects database-free.
 *
 * Project pages are statically generated, so a newly published (or withdrawn)
 * panorama appears on the next build.
 */
export async function loadProjectTour(project: Project): Promise<PanoramaTour | null> {
  if (!project.tour) return null;
  const ids = tourMediaAssetIds(project);
  let published = new Map<string, PublishedPanorama>();
  if (ids.length > 0) {
    try {
      const rows = await prisma.mediaAsset.findMany(publishedPanoramaQuery(project.slug, ids));
      published = toPublishedPanoramas(rows, project.slug);
    } catch {
      // Media must never break a project page: show the tour without those scenes.
      console.error(`[project-tour] could not load published panoramas for ${project.slug}`);
    }
  }
  const { tour, problems } = projectTourConfig(project, published);
  if (problems.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`[project-tour] ${project.slug}: ${problems.join("; ")}`);
  }
  return tour;
}
