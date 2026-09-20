"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Aarvasa3DViewer } from "@/components/viewer/aarvasa-3d-viewer";
import { trackViewerEvent } from "@/lib/viewer/analytics";
import { detectDeviceClass } from "@/lib/viewer/capabilities";
import { assessSplat, type DeviceClass } from "@/lib/viewer/splat-budget";
import type { ViewerSource, ViewerStatus } from "@/lib/viewer/types";

export type SplatViewerProps = {
  label: string;
  source: Extract<ViewerSource, { kind: "splat" }>;
  poster?: { src: string; width: number; height: number; alt: string };
  /** Project slug, for analytics only. */
  analyticsId?: string;
  className?: string;
  /** Shows a close button that calls this (the parent unmounts the viewer). */
  onExit?: () => void;
  onStatusChange?: (status: ViewerStatus) => void;
};

const subscribeNever = () => () => {};

/**
 * A Gaussian splat scene on top of Aarvasa3DViewer, with the device budget
 * applied before anything is downloaded (src/lib/viewer/splat-budget.ts):
 * scenes over this device's target need an explicit "Load anyway", and scenes
 * too large for it are not offered at all. The engine checks the real size and
 * splat count again after download, before any GPU upload.
 */
export function SplatViewer({ label, source, poster, analyticsId, className, onExit, onStatusChange }: SplatViewerProps) {
  // null while server rendering and hydrating; the gate only applies in the browser.
  const device = useSyncExternalStore<DeviceClass | null>(subscribeNever, detectDeviceClass, () => null);
  const assessment = device ? assessSplat(source, device) : { verdict: "ok" as const };
  const [confirmed, setConfirmed] = useState(false);

  const onStatusRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusRef.current = onStatusChange;
  });
  const previous = useRef<ViewerStatus>("idle");
  const handleStatus = useCallback(
    (status: ViewerStatus) => {
      onStatusRef.current?.(status);
      if (previous.current === "idle" && status !== "idle") trackViewerEvent("splat_opened", { project: analyticsId });
      if (status === "ready" && previous.current !== "ready") trackViewerEvent("splat_loaded", { project: analyticsId });
      if (status === "error") trackViewerEvent("splat_error", { project: analyticsId, errorKind: "load" });
      if (status === "unsupported") trackViewerEvent("splat_error", { project: analyticsId, errorKind: "unsupported" });
      previous.current = status;
    },
    [analyticsId],
  );

  if (assessment.verdict !== "ok" && !confirmed) {
    return (
      <section
        aria-label={label}
        data-viewer-kind="splat"
        data-viewer-status={assessment.verdict}
        className={cn("relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-background text-foreground sm:aspect-video", className)}
      >
        {poster && <Image src={poster.src} alt={poster.alt} fill unoptimized sizes="100vw" className="object-cover" />}
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center", poster ? "bg-background/70 backdrop-blur-sm" : "bg-background")}>
          <TriangleAlert className="h-7 w-7 text-accent" aria-hidden />
          <p className="text-base font-semibold text-foreground">{assessment.verdict === "heavy" ? "Large 3D scan" : "3D scan unavailable on this device"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{assessment.reason}</p>
          {assessment.verdict === "heavy" && (
            <Button onClick={() => setConfirmed(true)} className="mt-2">
              Load anyway
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <Aarvasa3DViewer
      className={className}
      label={label}
      source={source}
      poster={poster}
      // The visitor already chose to load a heavy scene; don't ask twice.
      loadOn={confirmed ? "visible" : "interaction"}
      onStatusChange={handleStatus}
      overlay={
        onExit
          ? () => (
              <div className="absolute left-3 top-3 z-10 rounded-xl bg-[var(--glass-strong)] p-1 backdrop-blur-md">
                <Button variant="ghost" size="icon" onClick={onExit} aria-label="Close 3D scan" title="Close 3D scan" className="h-10 w-10 text-foreground">
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            )
          : undefined
      }
    />
  );
}
