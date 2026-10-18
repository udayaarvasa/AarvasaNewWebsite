import { MotionReveal } from "@/components/layout/motion-reveal";
import { SectionHead, Wrap } from "@/components/av/primitives";
import { ImmersiveExperience } from "./immersive-viewer";
import type { ProjectViewerConfig } from "@/lib/viewer/project-media";
import type { ProjectSplatConfig } from "@/lib/viewer/project-splat";
import type { PanoramaTour } from "@/lib/viewer/tour";

function formatDownload(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return bytes >= 10_000 ? `${Math.round(bytes / 1000)} kB` : `${(bytes / 1000).toFixed(1)} kB`;
}

/**
 * "Explore" section for projects with immersive media: any combination of a
 * 3D model, a 360° tour and a Gaussian splat scan. Everything here has already
 * passed server-side gating (projectViewerConfig, loadProjectTour,
 * loadProjectSplat); only public, published data arrives.
 */
export default function ImmersiveSection({
  viewer,
  tour,
  splat = null,
  projectName,
  projectSlug,
  bare = false,
}: {
  viewer: ProjectViewerConfig | null;
  tour: PanoramaTour | null;
  splat?: ProjectSplatConfig | null;
  projectName: string;
  projectSlug: string;
  /** Inside the combined 3D board, which supplies its own heading. */
  bare?: boolean;
}) {
  if (!viewer && !tour && !splat) return null;
  const heading = tour && (viewer || splat) ? "Explore in 3D and 360°" : tour ? "Explore in 360°" : "Explore in 3D";
  const placeholders = [viewer?.placeholder && "3D model", tour?.placeholder && "360° tour", splat?.placeholder && "3D scan"].filter(
    (p): p is string => typeof p === "string",
  );
  const list = placeholders.length > 2 ? `${placeholders.slice(0, -1).join(", ")} and ${placeholders.at(-1)}` : placeholders.join(" and ");

  return (
    <section aria-label={heading}>
      <Wrap>
      {!bare && (
      <MotionReveal>
        <SectionHead label="Explore" title={heading} />
        <p className="-mt-[var(--s-6)] mb-[var(--s-5)] max-w-[62ch] text-[13.5px] leading-relaxed text-stage-muted">
          {viewer && <>Orbit and zoom an interactive model ({formatDownload(viewer.downloadBytes)}). </>}
          {tour && <>Look around {tour.scenes.length === 1 ? "a 360° view" : `${tour.scenes.length} rooms in 360°`} and move between them. </>}
          {splat && <>Orbit a Gaussian splat 3D scan{splat.source.sizeBytes ? ` (${formatDownload(splat.source.sizeBytes)})` : ""}. </>}
          Nothing downloads until you choose to open it.
        </p>
        {placeholders.length > 0 && (
          <p role="note" className="mb-[var(--s-5)] rounded-sm border border-stage-rule bg-stage-raised px-4 py-3 text-[12.5px] leading-relaxed text-stage-muted">
            Development pilot: the {list} {placeholders.length > 1 ? "are placeholders that test" : "is a placeholder that tests"} the
            immersive media pipeline. {placeholders.length > 1 ? "They do" : "It does"} not show {projectName}.
          </p>
        )}
      </MotionReveal>
      )}
      {/* Outside MotionReveal so the canvas is never inside an animating transform. */}
      <ImmersiveExperience model={viewer} tour={tour} splat={splat} analyticsId={projectSlug} />
      </Wrap>
    </section>
  );
}
