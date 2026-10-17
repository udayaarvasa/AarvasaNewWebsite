import type { ResolvedTourScene } from "@/lib/immersive-tours";

/**
 * Development-only fixture for the Immersive Tour bench.
 *
 * The film is a generated test pattern — FFmpeg's testsrc2 colour bars with a
 * running counter and a tone — not footage of any property. It was put through
 * the real media pipeline (`npm run media:process`), which staged it under its
 * content-addressed key, and the lab serves it through the same dev CDN
 * stand-in as the pilot model.
 *
 * This exists to exercise the player. Property pages never see it: they get
 * their films from the PUBLIC media resolver and nothing else.
 */
const KEY = "m/b770753bd4226f39c45e2c4e/c1136f36f2407eb0";

const film = {
  ref: "lab-film",
  url: `/labs/media/${KEY}/film.mp4`,
  posterUrl: `/labs/media/${KEY}/poster.jpg`,
  mimeType: "video/mp4" as const,
  width: 480,
  height: 848,
  altText: "Generated test pattern. Not a property.",
  provenanceLabel: "Internal test asset",
  provenanceNote: "Engineering test asset. Not a model of this project.",
};

export const LAB_FILM_SCENES: ResolvedTourScene[] = [
  { ref: "lab-1", title: "Test chapter one", categoryLabel: "Test", description: null, order: 1, startSeconds: 0, endSeconds: 5, video: film },
  { ref: "lab-2", title: "Test chapter two", categoryLabel: "Test", description: "Seeks to 5 s.", order: 2, startSeconds: 5, endSeconds: 10, video: film },
  { ref: "lab-3", title: "Test chapter three", categoryLabel: "Test", description: "Seeks to 10 s.", order: 3, startSeconds: 10, endSeconds: 16, video: film },
];
