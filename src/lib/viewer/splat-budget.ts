/**
 * How large a Gaussian splat scene the viewer will open on this device.
 *
 * The numbers are the Phase 2B-2 publishing budgets (infra/src/media-budgets.ts,
 * copied so browser bundles do not import infra code; a test keeps them equal).
 * They are review thresholds, not measured device limits.
 *
 * - above the hard limit (80 MB), nothing opens it: publishing already refuses it;
 * - above the device's target, the visitor is warned and must choose to load it,
 *   except where the device is "constrained" (touch-first or ≤ 4 GB reported
 *   memory) and the scene is past the *desktop* target: that is refused, so a
 *   phone is never asked to try a 50 MB+ / 3M+ gaussian scene;
 * - unknown size or count (older metadata) is checked again after download,
 *   before anything reaches the GPU.
 */

const MB = 1_000_000;

export const SPLAT_LIMITS = {
  bytes: { mobileTarget: 20 * MB, desktopTarget: 50 * MB, hardLimit: 80 * MB },
  gaussians: { mobileTarget: 1_000_000, desktopTarget: 3_000_000 },
} as const;

export type DeviceClass = "constrained" | "standard";

/** "constrained" for touch-first devices and those reporting ≤ 4 GB of memory (Chromium's navigator.deviceMemory). */
export function classifyDevice(signals: { coarsePointer: boolean; deviceMemoryGb?: number | null }): DeviceClass {
  if (signals.coarsePointer) return "constrained";
  if (typeof signals.deviceMemoryGb === "number" && signals.deviceMemoryGb > 0 && signals.deviceMemoryGb <= 4) return "constrained";
  return "standard";
}

export type SplatAssessment =
  | { verdict: "ok" }
  | { verdict: "heavy"; reason: string }
  | { verdict: "too-large"; reason: string };

const mb = (bytes: number) => `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB`;
const millions = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

export function assessSplat(scene: { sizeBytes: number | null; gaussians: number | null }, device: DeviceClass): SplatAssessment {
  const { sizeBytes, gaussians } = scene;
  const L = SPLAT_LIMITS;
  if (sizeBytes !== null && sizeBytes > L.bytes.hardLimit) {
    return { verdict: "too-large", reason: `This scene (${mb(sizeBytes)}) is larger than the viewer supports.` };
  }
  const overDesktop = (sizeBytes !== null && sizeBytes > L.bytes.desktopTarget) || (gaussians !== null && gaussians > L.gaussians.desktopTarget);
  if (device === "constrained" && overDesktop) {
    return { verdict: "too-large", reason: "This scene is too large to open safely on this device. Try a desktop computer." };
  }
  const target = device === "constrained" ? { bytes: L.bytes.mobileTarget, gaussians: L.gaussians.mobileTarget } : { bytes: L.bytes.desktopTarget, gaussians: L.gaussians.desktopTarget };
  const parts: string[] = [];
  if (sizeBytes !== null && sizeBytes > target.bytes) parts.push(mb(sizeBytes));
  if (gaussians !== null && gaussians > target.gaussians) parts.push(`${millions(gaussians)} splats`);
  if (parts.length > 0) {
    return { verdict: "heavy", reason: `This is a large scene (${parts.join(", ")}). It may be slow or fail to open on this device.` };
  }
  return { verdict: "ok" };
}

/** Splat budget handed to the engine (app.scene.gsplat.splatBudget): the device's gaussian target. */
export function splatBudgetFor(device: DeviceClass): number {
  return device === "constrained" ? SPLAT_LIMITS.gaussians.mobileTarget : SPLAT_LIMITS.gaussians.desktopTarget;
}
