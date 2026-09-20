/**
 * Viewer analytics: a tiny first-party event abstraction. There is no analytics
 * vendor in this site, so events are dispatched as a DOM CustomEvent
 * ("aarvasa:viewer") that a future integration can subscribe to, and nothing is
 * sent anywhere by this module.
 *
 * Every event is rebuilt from an allow-list: a closed set of names and a fixed
 * set of short, id-like properties. URLs, object keys, free text, error
 * messages and anything user-provided are never included.
 */

export const VIEWER_EVENTS = [
  "viewer_opened",
  "viewer_mode_selected",
  "panorama_opened",
  "hotspot_clicked",
  "panorama_navigation",
  "viewer_error",
  "splat_opened",
  "splat_loaded",
  "splat_error",
] as const;

export type ViewerEventName = (typeof VIEWER_EVENTS)[number];

export type ViewerEventProps = {
  /** Project slug, e.g. "reef-996-dubai-production-city". */
  project?: string;
  mode?: "model" | "panorama" | "splat";
  sceneId?: string;
  fromSceneId?: string;
  toSceneId?: string;
  hotspotId?: string;
  hotspotType?: "navigation" | "info";
  /** How navigation happened. */
  via?: "hotspot" | "selector";
  /** A coarse, fixed error category; never an error message. */
  errorKind?: "load" | "unsupported" | "context-lost" | "missing-target" | "too-large";
  placeholder?: boolean;
};

export type ViewerEvent = { name: ViewerEventName; props: ViewerEventProps };

export const VIEWER_EVENT_TYPE = "aarvasa:viewer";

/** Slugs and ids only: lowercase letters, digits and hyphens. */
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ENUMS: Partial<Record<keyof ViewerEventProps, readonly string[]>> = {
  mode: ["model", "panorama", "splat"],
  hotspotType: ["navigation", "info"],
  via: ["hotspot", "selector"],
  errorKind: ["load", "unsupported", "context-lost", "missing-target", "too-large"],
};
const ID_KEYS = ["project", "sceneId", "fromSceneId", "toSceneId", "hotspotId"] as const;

/** Returns the event with only allow-listed, well-formed properties, or null for an unknown event name. */
export function sanitizeViewerEvent(name: string, props: Record<string, unknown> = {}): ViewerEvent | null {
  if (!(VIEWER_EVENTS as readonly string[]).includes(name)) return null;
  const clean: Record<string, string | boolean> = {};
  for (const key of ID_KEYS) {
    const v = props[key];
    if (typeof v === "string" && SAFE_ID.test(v)) clean[key] = v;
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const v = props[key];
    if (typeof v === "string" && allowed.includes(v)) clean[key] = v;
  }
  if (typeof props.placeholder === "boolean") clean.placeholder = props.placeholder;
  return { name: name as ViewerEventName, props: clean as ViewerEventProps };
}

/** Records a viewer event. Safe to call anywhere; a no-op on the server. */
export function trackViewerEvent(name: ViewerEventName, props: ViewerEventProps = {}): void {
  // In the browser globalThis is window; on the server there is nothing to dispatch to.
  const target = globalThis as unknown as Partial<EventTarget>;
  if (typeof target.dispatchEvent !== "function" || typeof CustomEvent !== "function") return;
  const event = sanitizeViewerEvent(name, props);
  if (!event) return;
  target.dispatchEvent(new CustomEvent<ViewerEvent>(VIEWER_EVENT_TYPE, { detail: event }));
}
