"use client";

import Link from "next/link";
import { useState } from "react";
import { Aarvasa3DViewer } from "@/components/viewer/aarvasa-3d-viewer";
import { PanoramaTourViewer } from "@/components/viewer/panorama-tour";
import { TEST_360_TOUR } from "./lab-tour";
import { LAB_FILM_SCENES } from "./lab-film";
import { ImmersiveTour } from "@/components/property/immersive-tour";
import { Button } from "@/components/ui/button";
import type { ViewerSource, ViewerStatus } from "@/lib/viewer/types";

type SceneChoice = "procedural" | "sample" | "reef998" | "reef996v2" | "reef996v3" | "reef997" | "reef998v2" | "reef1000" | "blocked";

const SOURCES: Record<SceneChoice, ViewerSource | undefined> = {
  procedural: undefined,
  sample: { kind: "model", url: "/labs/viewer/sample.glb" },
  /* The REEF 998 reference-based reconstruction, served through the dev CDN
     stand-in under its real content-addressed key so the lab exercises the same
     path a published asset would. Staged only: no MediaAsset row, and INTERNAL
     when it gets one. */
  // Development only: the condition is folded at build time, so a production
  // bundle carries no path to the staged reconstruction.
  reef998:
    process.env.NODE_ENV === "production"
      ? undefined
      : { kind: "model", url: "/labs/media/m/3eecb8df7d61b40c456ee53d/0756752510fe54e4/scene.glb" },
  /* Reconstruction CANDIDATES under review (not approved, not published). Staged
     only in the gitignored media-pilot/.staging and reachable only through this
     development lab; production builds fold these to undefined. */
  reef996v2:
    process.env.NODE_ENV === "production"
      ? undefined
      : { kind: "model", url: "/labs/media/m/244d16103a0cdb3f4754208a/9ea83ecf6f4a8504/scene.glb", initialView: { yawDeg: 26, pitchDeg: 16, distanceFactor: 2.15 } },
  reef996v3:
    process.env.NODE_ENV === "production"
      ? undefined
      : { kind: "model", url: "/labs/media/m/244d16103a0cdb3f4754208a/32f29c26d09283b5/scene.glb", initialView: { yawDeg: 26, pitchDeg: 16, distanceFactor: 2.15 } },
  reef997:
    process.env.NODE_ENV === "production"
      ? undefined
      : { kind: "model", url: "/labs/media/m/051db7257f927a4af894a2fa/3ec2651523f35f1b/scene.glb", initialView: { yawDeg: -50, pitchDeg: 12, distanceFactor: 2.2 } },
  reef998v2:
    process.env.NODE_ENV === "production"
      ? undefined
      : { kind: "model", url: "/labs/media/m/3eecb8df7d61b40c456ee53d/589b15693f0a2ef6/scene.glb" },
  /* REEF 1000 draft v0.1 (tools/reef-1000-massing.py): U-plan from the
     developer's front and rear renders. Draft — never on a project page. */
  reef1000:
    process.env.NODE_ENV === "production"
      ? undefined
      : { kind: "model", url: "/labs/media/m/27cfb97645c9b41b486ca506/aeb69aa08baf1b75/scene.glb", initialView: { yawDeg: -40, pitchDeg: 14, distanceFactor: 1.9 } },
  // Must be rejected by the same-origin guard without any request being made.
  blocked: { kind: "model", url: "https://example.com/untrusted.glb" },
};

/** Evaluation lighting: a low key light from the side with shadows, so plan
 *  curvature reads as it does in the developer's renders. Lab only. */
const RAKING_LIGHT = { keyPitchDeg: 35, keyYawDeg: 70, intensity: 1.5, ambient: 0.3, shadows: true };

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={option.value === value ? "default" : "outline"}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function ViewerLab({ initialLoadOn }: { initialLoadOn: "visible" | "interaction" }) {
  const [bench, setBench] = useState<"model" | "tour" | "film">("model");
  const [scene, setScene] = useState<SceneChoice>("procedural");
  const [loadOn, setLoadOn] = useState<"visible" | "interaction">(initialLoadOn);
  const [autoRotate, setAutoRotate] = useState<"off" | "on">("off");
  const [lighting, setLighting] = useState<"standard" | "raking">("standard");
  const [mounted, setMounted] = useState<"mounted" | "unmounted">("mounted");
  const [second, setSecond] = useState<"hidden" | "shown">("hidden");
  const [status, setStatus] = useState<ViewerStatus>("idle");

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <span className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Development only
      </span>
      <h1 className="heading-serif mt-4 text-3xl text-foreground sm:text-4xl">Viewer lab</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Test bench for the PlayCanvas viewer foundation — the 3D model viewer, and the
        TEST-360 tour built from generated compass grids. Nothing here depicts a real
        property. This route returns 404 in production builds and is not linked from the
        site.
      </p>

      <div className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5">
        <Choice
          label="Bench"
          value={bench}
          onChange={setBench}
          options={[
            { value: "model", label: "3D model" },
            { value: "tour", label: "TEST-360 tour" },
            { value: "film", label: "Tour film" },
          ]}
        />
        <Choice
          label="Scene"
          value={scene}
          onChange={setScene}
          options={[
            { value: "procedural", label: "Procedural" },
            { value: "sample", label: "Sample GLB" },
            { value: "reef998", label: "REEF 998" },
            { value: "reef996v2", label: "REEF 996 v2 (candidate)" },
            { value: "reef996v3", label: "REEF 996 v3 (candidate)" },
            { value: "reef997", label: "REEF 997 (candidate)" },
            { value: "reef998v2", label: "REEF 998 v3 (candidate)" },
            { value: "reef1000", label: "REEF 1000 v0.1 (draft)" },
            { value: "blocked", label: "Blocked URL" },
          ]}
        />
        <Choice
          label="Load on"
          value={loadOn}
          onChange={setLoadOn}
          options={[
            { value: "visible", label: "Visible" },
            { value: "interaction", label: "Interaction" },
          ]}
        />
        <Choice
          label="Auto-rotate"
          value={autoRotate}
          onChange={setAutoRotate}
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
        />
        <Choice
          label="Lighting"
          value={lighting}
          onChange={setLighting}
          options={[
            { value: "standard", label: "Standard (production)" },
            { value: "raking", label: "Raking + shadows (evaluation)" },
          ]}
        />
        <Choice
          label="Viewer"
          value={mounted}
          onChange={setMounted}
          options={[
            { value: "mounted", label: "Mounted" },
            { value: "unmounted", label: "Unmounted" },
          ]}
        />
        <Choice
          label="Second viewer"
          value={second}
          onChange={setSecond}
          options={[
            { value: "hidden", label: "Hidden" },
            { value: "shown", label: "Shown" },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Status: <span className="font-semibold text-foreground" data-testid="viewer-status">{status}</span>
        </p>
      </div>

      <div className="mt-6">
        {mounted === "mounted" &&
          (bench === "film" ? (
            /* The Immersive Tour player, on a generated test film staged by the
               real pipeline. Flat video; never routed near the panorama viewer. */
            <div className="bg-stage p-6">
              <ImmersiveTour scenes={LAB_FILM_SCENES} projectName="Viewer lab" />
            </div>
          ) : bench === "tour" ? (
            /* The 360° bench. Orientation is checkable by eye: room A opens
               facing "0° FRONT", and its info hotspot must sit above that
               label. Room B opens at yaw 90, so returning to it proves each
               scene restores its own view rather than the previous room's. */
            <PanoramaTourViewer
              tour={TEST_360_TOUR}
              analyticsId="viewer-lab"
              onStatusChange={setStatus}
            />
          ) : (
            <Aarvasa3DViewer
              // Changing the load strategy only makes sense from a fresh mount.
              key={`${loadOn}-${lighting}`}
              label="Viewer lab scene"
              source={SOURCES[scene]}
              loadOn={loadOn}
              autoRotate={autoRotate === "on"}
              lighting={lighting === "raking" ? RAKING_LIGHT : undefined}
              onStatusChange={setStatus}
            />
          ))}
      </div>

      {second === "shown" && (
        <div className="mt-6">
          <Aarvasa3DViewer label="Second viewer instance" autoRotate />
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/listings" className="font-semibold text-foreground underline underline-offset-4">
          Leave the lab
        </Link>{" "}
        to check that client-side navigation tears the viewer down.
      </p>

      {/* Scroll the viewer out of view to check that rendering pauses. */}
      <div className="mt-10 flex h-[120vh] items-start rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Scroll spacer — the viewer above should pause while it is off screen.
      </div>
    </div>
  );
}
