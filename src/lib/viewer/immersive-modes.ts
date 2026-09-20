/** The project page's immersive experiences, in tab order. */
export type ImmersiveMode = "model" | "panorama" | "splat";

export const IMMERSIVE_MODE_LABELS: Readonly<Record<ImmersiveMode, string>> = {
  model: "3D model",
  panorama: "360° tour",
  splat: "3D scan",
};

/** Which experiences a project offers, from what passed server-side gating. Empty: no section. */
export function immersiveModes(media: { model: unknown; tour: unknown; splat: unknown }): ImmersiveMode[] {
  return [...(media.model ? (["model"] as const) : []), ...(media.tour ? (["panorama"] as const) : []), ...(media.splat ? (["splat"] as const) : [])];
}
