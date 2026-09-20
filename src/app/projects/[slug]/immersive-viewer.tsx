"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { trackViewerEvent } from "@/lib/viewer/analytics";
import type { ProjectViewerConfig } from "@/lib/viewer/project-media";
import type { PanoramaTour } from "@/lib/viewer/tour";
import type { ViewerStatus } from "@/lib/viewer/types";

/**
 * Lazy client boundaries for the viewer shells. Next.js only code-splits
 * next/dynamic inside Client Components, so this keeps the viewers out of the
 * JavaScript of project pages that have no immersive media. The PlayCanvas
 * engine is split again inside the viewer and loads only when the user asks.
 */
export const ImmersiveViewer = dynamic(() =>
  import("@/components/viewer/aarvasa-3d-viewer").then((m) => m.Aarvasa3DViewer),
);

const PanoramaTourViewer = dynamic(() => import("@/components/viewer/panorama-tour").then((m) => m.PanoramaTourViewer));

type Mode = "model" | "panorama";

const TAB_LABELS: Record<Mode, string> = { model: "3D model", panorama: "360° tour" };

/**
 * The project page's immersive area: a 3D model, a 360° tour, or both behind
 * tabs. Only the selected experience is mounted, and each waits for the visitor
 * to open it, so nothing is downloaded automatically and never both at once.
 */
export function ImmersiveExperience({
  model,
  tour,
  analyticsId,
}: {
  model: ProjectViewerConfig | null;
  tour: PanoramaTour | null;
  analyticsId: string;
}) {
  const modes: Mode[] = [...(model ? (["model"] as const) : []), ...(tour ? (["panorama"] as const) : [])];
  const [mode, setMode] = useState<Mode>(modes[0] ?? "model");
  // Remounting a viewer returns it to its idle, not-downloaded state (used by "Close tour").
  const [generation, setGeneration] = useState(0);
  const tabs = useRef(new Map<Mode, HTMLButtonElement>());
  const baseId = `immersive-${analyticsId}`;

  const lastStatus = useRef<ViewerStatus>("idle");
  const report = useCallback(
    (forMode: Mode, status: ViewerStatus) => {
      if (lastStatus.current === "idle" && status !== "idle") trackViewerEvent("viewer_opened", { project: analyticsId, mode: forMode });
      if (status === "unsupported") trackViewerEvent("viewer_error", { project: analyticsId, mode: forMode, errorKind: "unsupported" });
      if (status === "context-lost") trackViewerEvent("viewer_error", { project: analyticsId, mode: forMode, errorKind: "context-lost" });
      lastStatus.current = status;
    },
    [analyticsId],
  );
  const onModelStatus = useCallback((status: ViewerStatus) => report("model", status), [report]);
  const onTourStatus = useCallback((status: ViewerStatus) => report("panorama", status), [report]);

  const select = (next: Mode) => {
    if (next === mode) return;
    lastStatus.current = "idle";
    setMode(next);
    trackViewerEvent("viewer_mode_selected", { project: analyticsId, mode: next });
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = modes.indexOf(mode);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = modes[(index + step + modes.length) % modes.length];
    select(next);
    tabs.current.get(next)?.focus();
  };

  if (modes.length === 0) return null;
  const active = modes.includes(mode) ? mode : modes[0];

  const panel =
    active === "model" && model ? (
      <ImmersiveViewer
        key={`model-${generation}`}
        label={model.label}
        source={model.source}
        poster={model.poster ?? undefined}
        loadOn="interaction"
        onStatusChange={onModelStatus}
      />
    ) : tour ? (
      <PanoramaTourViewer
        key={`tour-${generation}`}
        tour={tour}
        analyticsId={analyticsId}
        onStatusChange={onTourStatus}
        onExit={() => {
          lastStatus.current = "idle";
          setGeneration((n) => n + 1);
        }}
      />
    ) : null;

  if (modes.length === 1) return <div className="mt-5">{panel}</div>;

  return (
    <div className="mt-5">
      <div role="tablist" aria-label="Immersive view" className="mb-3 inline-flex rounded-full border border-border bg-muted p-1">
        {modes.map((m) => (
          <button
            key={m}
            ref={(el) => {
              if (el) tabs.current.set(m, el);
              else tabs.current.delete(m);
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${m}`}
            aria-selected={m === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={m === active ? 0 : -1}
            onClick={() => select(m)}
            onKeyDown={onTabKey}
            className={cn(
              "min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
              m === active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABELS[m]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
        {panel}
      </div>
    </div>
  );
}
