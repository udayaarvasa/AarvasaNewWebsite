import { prisma } from "@/lib/prisma";
import type { Project } from "@/lib/project-types";
import { projectSplatConfig, splatMediaAssetId, type ProjectSplatConfig } from "@/lib/viewer/project-splat";
import { publishedSplatQuery, toPublishedSplat, type PublishedSplat } from "@/lib/viewer/published-splats";

/**
 * Server-only: the public Gaussian splat scene for a project page, or null.
 *
 * Looks up only the asset id the project names, and only as a PUBLISHED
 * SPLAT/SOG of that project (publishedSplatQuery). Projects without a published
 * splat (including the fixture-only pilot) never touch the database. Pages are
 * statically generated, so publication changes appear on the next build.
 */
export async function loadProjectSplat(project: Project): Promise<ProjectSplatConfig | null> {
  if (!project.splat) return null;
  const id = splatMediaAssetId(project);
  let published: PublishedSplat | null = null;
  if (id) {
    try {
      published = toPublishedSplat(await prisma.mediaAsset.findFirst(publishedSplatQuery(project.slug, id)), project.slug);
    } catch {
      // Media must never break a project page: show it without the scene.
      console.error(`[project-splat] could not load the published splat for ${project.slug}`);
    }
  }
  return projectSplatConfig(project, published);
}
