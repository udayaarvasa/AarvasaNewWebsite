# Explore Area — Google Maps setup

"Explore Area" shows a project in its real surroundings using Google's
photorealistic 3D map. It is geographic context only: the property's own model
stays in the PlayCanvas viewer, because Google's mesh of an off-plan plot is
whatever was flown over at the time — usually a construction site or bare
ground — and presenting that as the building would be a fabrication.

The section is currently **unavailable on every project**, for two separate
reasons. Both are listed here because neither can be fixed from the code alone.

## 1. No browser API key

`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is unset, so nothing is loaded and the
section says so rather than rendering a dead viewport.

To enable it:

1. In the Google Cloud console, enable **Maps JavaScript API** on the project.
   Photorealistic 3D Maps is part of it; it is billed per map load, so the
   component loads nothing until a visitor clicks "Explore area".
2. Create an **API key**, and restrict it:
   - *Application restrictions* → **HTTP referrers**, listing only the domains
     that serve this app (and `http://localhost:3000/*` for development).
   - *API restrictions* → **Restrict key**, allowing only Maps JavaScript API.
3. Put it in the environment as `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.

The `NEXT_PUBLIC_` prefix is correct and deliberate. A Maps browser key is
public by construction — it travels in the script URL and is visible to anyone
who opens the page — and is protected by the referrer restriction above, not by
secrecy. **Never put a server-side key here**, and never reuse a key that has
other APIs enabled on it: a key with, say, Geocoding or Places enabled becomes a
free quota for anyone who copies it out of the page source.

## 2. Coordinates, where they exist

| Project | Coordinates | Precision |
| --- | --- | --- |
| REEF 996 — Dubai Production City (IMPZ) | 25.03785, 55.20126 | locality |
| REEF 997 — Dubai Islands | 25.28990, 55.30238 | locality |
| REEF 998 — Dubai Land Residence Complex | 25.10029, 55.37471 | locality |
| Aaradhyam Pearl — Badwai, Bhopal | none | — |
| Aaradhyam Prime — Jatkhedi, Bhopal | 23.17633, 77.4694 | locality |

The three REEF positions were reconciled against an independent reverse geocode
before being recorded (`docs/reef-immersive-status.md`). They are **locality**
precision — the right community, not a surveyed plot — which is enough to show
somebody their surroundings and not enough to stand a building on. That is why
the model overlay stays off.

Where a record has no coordinates, a latitude that looks plausible for its
locality would be a made-up fact about where somebody's home is, and a wrong pin
is worse than no pin, so the section refuses rather than guesses. Supply
coordinates by editing the project's record
(`src/lib/projects.ts` for the hand-maintained entries; `reef-projects.ts` is
generated, so attach coordinates in `projects.ts` as the imagery and media are).
Take them from the developer's own filing or a surveyed address — not from a
search box.

## Coverage is discovered, not assumed

Google's photorealistic 3D mesh is city-scale and much of the world has none.
There is no API that answers "is there 3D here", so the component requests the
3D map and watches: if the element never initialises it falls back to the flat
satellite map at the same coordinates, and says which one the visitor is
looking at. Dubai has dense coverage; Bhopal is unlikely to, which means the one
project that does have coordinates today will probably show the flat map.

## Attribution

`GOOGLE_ATTRIBUTION` is rendered under every map and the 3D element draws
Google's own logo. Neither may be removed or obscured — it is a condition of the
Maps terms of service.
