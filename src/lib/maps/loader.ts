/**
 * One Maps JavaScript API script per document, shared by everything that needs
 * it.
 *
 * Explore Area and the nearby-places panel both want Google, and they are
 * separate components a visitor can open in either order. Two script tags for
 * the same API is a double download and an undefined winner, so the promise is
 * module scope: whoever asks first creates the tag, everyone else waits on the
 * same promise.
 *
 * Nothing here runs until a visitor opens one of those sections. The API is a
 * few hundred kilobytes and starts billing the moment it initialises, so a
 * project page that nobody explores costs nothing.
 */

declare global {
  interface Window {
    google?: {
      maps?: { importLibrary?: (name: string) => Promise<unknown> };
    };
    /** Google calls this when it rejects the API key. */
    gm_authFailure?: () => void;
  }
}

import { mapsScriptUrl } from "./google-3d";

/*
 * Set when Google rejects the key.
 *
 * It is a document-wide callback with no context, so the flag has to be module
 * scope and every mounted map reads it. Without it the page reported a working
 * map while Google's own "didn't load correctly" panel was rendered inside the
 * frame.
 *
 * Known limitation: this does NOT fire on the alpha 3D path, so a rejected key
 * cannot be detected there. Explore Area therefore does not rely on it alone —
 * see the flat-map witness in explore-area.tsx.
 */
let authFailed = false;

/** Has Google rejected this deployment's key at any point on this page? */
export const keyWasRejected = (): boolean => authFailed;

let scriptPromise: Promise<void> | null = null;

/** Load the Maps JS API once per document, whatever calls it. */
export function loadMaps(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-aarvasa-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("maps script failed")));
      return;
    }
    window.gm_authFailure = () => {
      authFailed = true;
    };
    const script = document.createElement("script");
    script.src = mapsScriptUrl(apiKey);
    script.async = true;
    script.dataset.aarvasaMaps = "true";
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("maps script failed")));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Import one Maps library by name.
 *
 * `loadMaps` must have resolved first. The script is bootstrapped with only the
 * 3D library in its URL; `importLibrary` fetches any other on demand, which is
 * how the flat map, the marker and Places arrive without widening the initial
 * download for visitors who never open them.
 */
export async function importMapsLibrary<T>(name: string): Promise<T> {
  const importLibrary = window.google?.maps?.importLibrary;
  if (!importLibrary) throw new Error("maps api did not initialise");
  return (await importLibrary(name)) as T;
}
