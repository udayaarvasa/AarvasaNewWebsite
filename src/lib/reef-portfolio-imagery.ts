/**
 * REEF 999 and REEF 1000 web imagery, cropped from the developer's renders.
 * Both projects are off-plan, so every frame is a RENDER and says so. Shown
 * under the permission recorded in IMAGERY_PERMISSION (projects.ts).
 */
import type { ProjectCuratedImage, ProjectImagery, ProjectImageRatio } from "./project-types";

const RATIOS: readonly ProjectImageRatio[] = ["16x9", "4x5", "3x2", "1x1"];

const img = (dir: string, id: string, alt: string, caption: string): ProjectCuratedImage => ({
  id,
  dir,
  ratios: RATIOS,
  alt,
  caption,
  origin: "render",
});

const R999_NIGHT = img(
  "/images/reef-999/hero",
  "reef-999-night",
  "Render of REEF 999 at night: twin stepped towers with warmly lit balconies over a podium.",
  "REEF 999 at night — developer render",
);
const R999_DUSK = img(
  "/images/reef-999/gallery",
  "reef-999-dusk",
  "Render of REEF 999 in evening light: glazed towers and deep balconies, palms along the podium.",
  "REEF 999 in evening light — developer render",
);

const R1000_NIGHT = img(
  "/images/reef-1000/hero",
  "reef-1000-night",
  "Render of REEF 1000 at night: a curved mid-rise building with a lit retail frontage.",
  "REEF 1000 at night — developer render",
);
const R1000_FRONT = img(
  "/images/reef-1000/gallery",
  "reef-1000-front",
  "Render of the front of REEF 1000 by day, with its drop-off road and rooftop palms.",
  "Front elevation — developer render",
);
const R1000_REAR = img(
  "/images/reef-1000/gallery",
  "reef-1000-rear",
  "Aerial render of the rear of REEF 1000, with landscaped gardens around the podium.",
  "Rear aerial view — developer render",
);

export const REEF_999_IMAGERY: ProjectImagery = {
  hero: R999_NIGHT,
  gallery: [R999_DUSK],
  cards: [R999_DUSK],
  details: [],
  banners: [],
};

export const REEF_1000_IMAGERY: ProjectImagery = {
  hero: R1000_NIGHT,
  gallery: [R1000_FRONT, R1000_REAR],
  cards: [R1000_FRONT],
  details: [],
  banners: [],
};
