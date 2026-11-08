import type { Project } from "./project-types";
import { projectImageSrc } from "./project-types";
import { REEF_RELEASE_IMAGES } from "./reef-release-images";

/** Reviewed developer references, attached after the existing permission gate. */
export function withReefReleaseImagery(project: Project): Project {
  const added = REEF_RELEASE_IMAGES[project.slug];
  if (!added || !project.imagery) return project;
  const exterior = added.find((image) => image.alt.includes("Exterior Architecture"));
  const imagery = {
    ...project.imagery,
    hero: exterior ?? project.imagery.hero,
    gallery: [...(exterior ? [project.imagery.hero] : []), ...project.imagery.gallery, ...added.filter((image) => image !== exterior)],
    details: [...project.imagery.details, ...added],
  };
  return {
    ...project,
    imagery,
    images: [projectImageSrc(imagery.hero, "3x2"), ...imagery.gallery.map((image) => projectImageSrc(image, "3x2"))],
  };
}
