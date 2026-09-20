import { MEDIA_KEY_PATTERN, publishedObjectMetadata } from "../../../shared/media-contract";
import type { Project } from "../project-types";
import { MEDIA_CDN_ORIGIN } from "./media-origin";
import type { ViewerSource } from "./types";

/**
 * Maps a project's immersive media (manifest-shaped object keys) to what the
 * generic Aarvasa3DViewer needs. This is the only place that knows about both
 * projects and the viewer; the viewer itself never sees a Project.
 *
 * Server-safe: no PlayCanvas, no browser APIs.
 */

export type ProjectViewerConfig = {
  readonly label: string;
  readonly source: ViewerSource;
  readonly poster: { readonly src: string; readonly width: number; readonly height: number; readonly alt: string } | null;
  readonly downloadBytes: number;
  /** True when the asset does not depict the project; the page must say so. */
  readonly placeholder: boolean;
};

/** Returns viewer props for a project, or null when it has no media that can be shown in this build. */
export function projectViewerConfig(
  project: Project,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ProjectViewerConfig | null {
  const media = project.immersive;
  if (!media) return null;
  if (media.review !== "approved" && nodeEnv === "production") return null;

  // Development: the DEV media CDN. Production has no media origin yet, so nothing is shown.
  const origin = nodeEnv === "production" ? null : MEDIA_CDN_ORIGIN;
  if (!origin) return null;

  // The data is hand-copied from a manifest, so re-check it against the storage
  // contract instead of building URLs from whatever it contains.
  const entryKey = `${media.storageKey}/${media.entryFile}`;
  const entryMeta = publishedObjectMetadata(entryKey);
  if (!MEDIA_KEY_PATTERN.test(entryKey) || entryMeta?.contentType !== "model/gltf-binary") return null;

  const posterMeta = media.poster ? publishedObjectMetadata(media.poster.key) : null;
  const posterValid =
    media.poster !== null && posterMeta !== null && media.poster.key.startsWith(`${media.storageKey}/`) && posterMeta.contentType.startsWith("image/");

  return {
    label: media.review === "placeholder" ? `Pilot 3D model for ${project.name} (placeholder)` : `${project.name} 3D model`,
    source: { kind: "model", url: `${origin}/${entryKey}` },
    poster:
      posterValid && media.poster
        ? { src: `${origin}/${media.poster.key}`, width: media.poster.width, height: media.poster.height, alt: media.altText }
        : null,
    downloadBytes: media.sizeBytes,
    placeholder: media.review === "placeholder",
  };
}
