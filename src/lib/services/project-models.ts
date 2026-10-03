import { prisma } from "@/lib/prisma";
import type { Project } from "@/lib/project-types";
import { MEDIA_CDN_ORIGIN } from "@/lib/viewer/media-origin";
import { projectViewerConfig, type ProjectViewerConfig } from "@/lib/viewer/project-media";
import { publishedModelQuery, toPublishedModel } from "@/lib/viewer/published-models";

/**
 * Server-only: the 3D model a project page shows, or null.
 *
 * A model that went through the real pipeline — upload, worker, review, publish —
 * wins over anything hand-authored in projects.ts. The static `immersive` block
 * remains as the fallback for the Phase 3 pilot placeholder, which exists to
 * exercise the viewer and is never shown in production builds.
 *
 * Preferring the published asset is the point: once a reviewer approves a real
 * model of a project, a page that still showed the placeholder would be
 * presenting a test cube as that project's architecture.
 *
 * Pages are statically generated, so publishing or withdrawing a model takes
 * effect on the next build — the same timing the tour and splat loaders have.
 */
export async function loadProjectModel(
  project: Project,
  options: { includeInternal?: boolean } = {},
): Promise<ProjectViewerConfig | null> {
  // No media origin in this build means no project can show a model at all, so
  // there is nothing to look up. Production is currently such a build.
  if (!MEDIA_CDN_ORIGIN) return null;
  try {
    const published = toPublishedModel(
      await prisma.mediaAsset.findFirst(publishedModelQuery(project.slug, options)),
      project.slug,
      options,
    );
    if (published) {
      // projectViewerConfig owns URL building and the storage-contract re-check,
      // so the published asset goes through exactly the same gate as a static one.
      const viewer = projectViewerConfig({ ...project, immersive: published });
      if (viewer) return viewer;
      console.error(`[project-model] published model rejected by the viewer contract for ${project.slug}`);
    }
  } catch {
    // Media must never break a project page: fall back to whatever is static.
    console.error(`[project-model] could not load the published model for ${project.slug}`);
  }
  return projectViewerConfig(project);
}

/**
 * Server-only: the slugs that have a model worth a "3D" mark — a published
 * MODEL asset, or the static pilot that non-production builds still show.
 *
 * Listing cards and the homepage band state 3D availability from real
 * server-side gating. Reading only `project.immersive` made them disagree with
 * the project page the moment a creator published a model, which is how a card
 * comes to say a project has no 3D while its page offers it.
 *
 * One query for every project, not one per card.
 */
export async function projectsWithModel(projects: readonly Project[]): Promise<ReadonlySet<string>> {
  const slugs = new Set(projects.filter((p) => projectViewerConfig(p)).map((p) => p.slug));
  // Same reasoning as loadProjectModel: with no media origin nothing is shown,
  // and a card must not advertise 3D that its project page cannot offer.
  if (!MEDIA_CDN_ORIGIN) return slugs;
  try {
    const rows = await prisma.mediaAsset.findMany({
      where: {
        status: "PUBLISHED",
        kind: "MODEL",
        subjectType: "PROJECT",
        projectSlug: { in: projects.map((p) => p.slug) },
        // A card must never advertise 3D that turns out to be a test asset.
        provenance: { not: "INTERNAL_TEST" },
      },
      select: { projectSlug: true },
      distinct: ["projectSlug"],
    });
    for (const row of rows) if (row.projectSlug) slugs.add(row.projectSlug);
  } catch {
    // A database that is down must not strip the pilot marks off every card.
    console.error("[project-model] could not list projects with published models");
  }
  return slugs;
}
