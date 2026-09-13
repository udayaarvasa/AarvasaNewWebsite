# Immersive media pilot (Phase 3)

Source files for the first project-page 3D pilot. They are run through the local
media pipeline and served in development only; nothing here is uploaded or shown
in production builds.

| File | What it is |
|---|---|
| `reef-996-dubai-production-city/pilot-tower.glb` | 1,840 B placeholder model (a tower on a podium slab) from the `/labs/viewer` sample generator. **Not a model of REEF 996.** |
| `reef-996-dubai-production-city/pilot-tower.poster.webp` | 1280×720 poster rendered from that model in the Phase 1 viewer |

```bash
npm run media:pilot:stage   # validate + stage to media-pilot/.staging/ (git-ignored), write-once
npm run dev                 # /projects/reef-996-dubai-production-city → "Explore in 3D"
```

- The keys in `src/lib/projects.ts` (`REEF_996_PILOT_MEDIA`) are copied from
  `media-pilot/.staging/reef-996-dubai-production-city/manifest.json`. They are
  content-addressed, so re-staging produces the same keys.
- `/labs/media/<key>` serves staged objects with the CDN's content type and
  cache headers in development, and returns 404 in production.
- A real, approved REEF 996 model is still required. Replace the source files,
  re-stage, copy the new manifest values, and set `review: "approved"`. A
  production media origin (the Phase 2B-1 CDN plus a viewer origin allow-list)
  must exist before anything renders in production.
