"use client";

import dynamic from "next/dynamic";

/**
 * Lazy client boundary for the viewer shell. Next.js only code-splits
 * next/dynamic inside Client Components, so this keeps Aarvasa3DViewer out of the
 * JavaScript of project pages that have no immersive media. The PlayCanvas engine
 * is split again inside the viewer and loads only when the user asks for 3D.
 */
export const ImmersiveViewer = dynamic(() =>
  import("@/components/viewer/aarvasa-3d-viewer").then((m) => m.Aarvasa3DViewer),
);
