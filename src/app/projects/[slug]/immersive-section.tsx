import { MotionReveal } from "@/components/layout/motion-reveal";
import { ImmersiveExperience } from "./immersive-viewer";
import type { ProjectViewerConfig } from "@/lib/viewer/project-media";
import type { PanoramaTour } from "@/lib/viewer/tour";

function formatDownload(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return bytes >= 10_000 ? `${Math.round(bytes / 1000)} kB` : `${(bytes / 1000).toFixed(1)} kB`;
}

/**
 * "Explore" section for projects with immersive media: a 3D model, a 360° tour,
 * or both. Everything here has already passed server-side gating
 * (projectViewerConfig, loadProjectTour); only public, published data arrives.
 */
export default function ImmersiveSection({
  viewer,
  tour,
  projectName,
  projectSlug,
}: {
  viewer: ProjectViewerConfig | null;
  tour: PanoramaTour | null;
  projectName: string;
  projectSlug: string;
}) {
  if (!viewer && !tour) return null;
  const heading = viewer && tour ? "Explore in 3D and 360°" : tour ? "Explore in 360°" : "Explore in 3D";
  const placeholders = [viewer?.placeholder && "3D model", tour?.placeholder && "360° tour"].filter(Boolean);

  return (
    <section className="mt-12" aria-labelledby="explore-3d-heading">
      <MotionReveal>
        <h2 id="explore-3d-heading" className="text-2xl font-black text-foreground">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {viewer && <>Orbit and zoom an interactive model ({formatDownload(viewer.downloadBytes)}). </>}
          {tour && <>Look around {tour.scenes.length === 1 ? "a 360° view" : `${tour.scenes.length} rooms in 360°`} and move between them. </>}
          Nothing downloads until you choose to open it.
        </p>
        {placeholders.length > 0 && (
          <p role="note" className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
            Development pilot: the {placeholders.join(" and ")} {placeholders.length > 1 ? "are placeholders that test" : "is a placeholder that tests"} the
            immersive media pipeline. {placeholders.length > 1 ? "They do" : "It does"} not show {projectName}.
          </p>
        )}
      </MotionReveal>
      {/* Outside MotionReveal so the canvas is never inside an animating transform. */}
      <ImmersiveExperience model={viewer} tour={tour} analyticsId={projectSlug} />
    </section>
  );
}
