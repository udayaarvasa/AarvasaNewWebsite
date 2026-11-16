import type { ProjectImmersiveMedia } from "./project-types";

const modelKey = "m/9c141ec528cce20366f05e2d/4bfcaa84b32b1293";

export const HOLM_CENTRAL_MODEL: ProjectImmersiveMedia = {
  mediaId: "9c141ec528cce20366f05e2d",
  kind: "MODEL",
  format: "GLB",
  storageKey: modelKey,
  entryFile: "scene.glb",
  contentHash: "4bfcaa84b32b1293965aa4be83b5f7a0abdb0c6d2c6fe23eb244b391305b0b6d",
  sizeBytes: 1_829_848,
  poster: { key: `${modelKey}/poster.jpg`, width: 1076, height: 446 },
  processingVersion: "holm-central-massing-v1",
  altText: "Aarvasa exterior study of HOLM Central’s two towers, the shared podium and pool courtyard.",
  review: "approved",
  hosting: "site",
  provenance: "AARVASA_RECONSTRUCTION",
  provenanceNote: "Exterior study based on HOLM’s floor plans and architectural renders.",
  view: { yawDeg: 19, pitchDeg: 25, distanceFactor: 2.2 },
  mobileView: { yawDeg: 26, pitchDeg: 30, distanceFactor: 2.7 },
  // Base is at −1.888 GLB units at a map scale of 10. The inspection
  // location corroborates the plot beside 12A Street. Heading follows
  // the visible street grid and is approximate.
  mapOverlay: {
    baseOffsetMetres: 18.88,
    coordinates: { lat: 25.228891, lng: 55.279281 },
    headingDegrees: 302,
  },
};
