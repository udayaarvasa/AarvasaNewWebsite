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

## Nearby places

The nearby-places panel sits under the map in the same column and shares its
gate exactly: the same browser key, the same verified coordinates. Measuring how
far a school is from a home starts from the home's position, so a coordinate
nobody checked would produce a distance nobody can stand behind.

Six categories — transit, schools, hospitals, shopping, dining, parks — one open
at a time, five closest results each, 2 km radius. The limits live in
`NEARBY_LIMITS` and travel inside `nearbyRequest()`, so a call site cannot
forget them.

It uses the **Places library (new)**, `Place.searchNearby`, with a field mask of
`id`, `displayName` and `location`. Places bills by field group; asking for
ratings, photos or opening hours we never render would be paying for data to
throw away. **The Places API (New) must be enabled on the key** — this is a
separate switch in the Cloud console from Maps JavaScript, and a key with only
Maps enabled returns an error for every category.

Every row comes from a Places result carrying its own id, name and position.
Anything missing one of the three is dropped rather than pinned at the property,
an empty category stays empty rather than borrowing from another, and the list
is labelled a sample rather than a survey (`NEARBY_DISCLAIMER`). `PLACES_ATTRIBUTION`
is rendered with the results and is a condition of the terms, like the map credit.

## Future enhancement: the model overlay

Placing the Aarvasa GLB into the Google 3D scene — the building standing on its
own plot, in its real surroundings — is **deliberately not implemented**, and
Explore Property and Explore Area remain two separate experiences.

It is blocked on facts, not on code. All three are required:

1. **Plot-accurate coordinates.** Today's are `locality` precision: the right
   community, not a surveyed position. A tower dropped on a locality-accurate
   point lands on whatever is actually there — a neighbouring building, a road,
   open sand — which turns an approximation into a false statement about which
   plot somebody is buying.
2. **A validated model scale.** The reconstruction is dimensionally plausible,
   not surveyed. At a distance in its own viewer that is honest; sitting beside
   Google's mesh of real neighbours it becomes a direct size comparison against
   buildings whose dimensions are real.
3. **A validated orientation.** Which way the facade faces decides the view from
   a balcony and the sun on it. Nothing in the source material establishes it,
   and a guessed heading is a claim about afternoon light in somebody's home.

Until all three exist, the overlay would present invented placement with the
authority of real surroundings, which is the one thing the surrounding
architecture exists to refuse. Revisit when the developer files a surveyed
position and either an official model or a measured reconstruction.
