# Immersive media pilot (Phase 3)

Source files for the first project-page 3D pilot. They are run through the local
media pipeline and published to the DEV media CDN (Phase 3.5.1). Development
builds load them from there; production builds show nothing.

| File | What it is |
|---|---|
| `reef-996-dubai-production-city/pilot-tower.glb` | 1,840 B placeholder model (a tower on a podium slab) from the `/labs/viewer` sample generator. **Not a model of REEF 996.** |
| `reef-996-dubai-production-city/pilot-tower.poster.webp` | 1280×720 poster rendered from that model in the Phase 1 viewer |

```bash
npm run media:pilot:stage   # validate + stage to media-pilot/.staging/ (git-ignored), write-once
npm run dev                 # /projects/reef-996-dubai-production-city → "Explore in 3D" (from the DEV CDN)
```

- The keys in `src/lib/projects.ts` (`REEF_996_PILOT_MEDIA`) are copied from
  `media-pilot/.staging/reef-996-dubai-production-city/manifest.json`. They are
  content-addressed, so re-staging produces the same keys.
- Published (write-once) to `aarvasa-media-dev-published-149465616428-ap-south-1`:
  `m/8ba87bf969112016e7905b6f/de1d54d4e9da0d02/{scene.glb,poster.webp}`, plus the
  private original at `originals/8ba87bf969112016e7905b6f/de1d54d4e9da0d02/pilot-tower.glb`.
  Development pages load them from `https://d1l4p1pty829ds.cloudfront.net`
  (`src/lib/viewer/media-origin.ts`).
- `/labs/media/<key>` still serves staged objects with the CDN's content type and
  cache headers in development (offline work), and returns 404 in production.
- A real, approved REEF 996 model is still required. Replace the source files,
  re-stage, publish, copy the new manifest values, and set `review: "approved"`.
  A production media CDN origin must be configured before anything renders in
  production.
