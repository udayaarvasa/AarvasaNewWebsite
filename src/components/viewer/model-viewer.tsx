"use client";

import { Aarvasa3DViewer } from "@/components/viewer/aarvasa-3d-viewer";
import { useXrSupport, XrControls } from "@/components/viewer/xr-controls";
import type { ProjectViewerConfig } from "@/lib/viewer/project-media";
import type { ViewerStatus } from "@/lib/viewer/types";

/**
 * The project page's 3D model experience: the existing viewer, plus the AR and
 * VR entry points when the project offers them and the device supports them
 * (Phase 8). Without XR this is exactly the Phase 1 viewer.
 */
export function ModelViewer({
  model,
  analyticsId,
  className,
  onStatusChange,
}: {
  model: ProjectViewerConfig;
  analyticsId?: string;
  className?: string;
  onStatusChange?: (status: ViewerStatus) => void;
}) {
  const experience = model.xr;
  // Only probed when the project actually offers XR, and never before the page is interactive.
  const support = useXrSupport(Boolean(experience));

  return (
    <Aarvasa3DViewer
      className={className}
      label={model.label}
      source={model.source}
      poster={model.poster ?? undefined}
      loadOn="interaction"
      onStatusChange={onStatusChange}
      overlay={
        experience
          ? (engine, status) => <XrControls engine={engine} status={status} experience={experience} support={support} analyticsId={analyticsId} />
          : undefined
      }
    />
  );
}
