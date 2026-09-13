import { MotionReveal } from "@/components/layout/motion-reveal";
import { ImmersiveViewer } from "./immersive-viewer";
import type { ProjectViewerConfig } from "@/lib/viewer/project-media";

function formatDownload(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return bytes >= 10_000 ? `${Math.round(bytes / 1000)} kB` : `${(bytes / 1000).toFixed(1)} kB`;
}

/** "Explore in 3D" section for projects that have immersive media. */
export default function ImmersiveSection({ viewer, projectName }: { viewer: ProjectViewerConfig; projectName: string }) {
  return (
    <section className="mt-12" aria-labelledby="explore-3d-heading">
      <MotionReveal>
        <h2 id="explore-3d-heading" className="text-2xl font-black text-foreground">
          Explore in 3D
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Orbit and zoom an interactive model. It downloads ({formatDownload(viewer.downloadBytes)}) only when you choose
          to load it.
        </p>
        {viewer.placeholder && (
          <p role="note" className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
            Development pilot: this placeholder model tests the 3D media pipeline. It is not a model of {projectName}.
          </p>
        )}
      </MotionReveal>
      {/* Outside MotionReveal so the canvas is never inside an animating transform. */}
      <ImmersiveViewer
        className="mt-5"
        label={viewer.label}
        source={viewer.source}
        poster={viewer.poster ?? undefined}
        loadOn="interaction"
      />
    </section>
  );
}
