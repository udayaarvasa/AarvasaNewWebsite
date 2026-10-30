# Media rights register

What Aarvasa may publish, and on what basis. A missing entry means "not cleared".

## REEF developer images and renders

| Field | Record |
| --- | --- |
| Status | Cleared for use, on the owner's confirmation |
| Date | 30 October 2026 |
| Basis | The Aarvasa project owner confirmed in the working session: first that REEF had agreed to the images being restored, then "all the reef properties have been cleared u can add the images for them too" |
| Projects | REEF 996, 997, 998, 999 and 1000 |
| Scope | Images and renders only |
| Enforced in | `IMAGERY_PERMISSION`, `src/lib/projects.ts` |
| Not on file | The written permission itself. The confirmation names no person at REEF, no date of REEF's agreement and no document reference, so none is recorded here |

**Action:** file REEF's written permission (who agreed, when, and what it covers)
and put its reference in this table and in `IMAGERY_PERMISSION`.

## Not covered by that confirmation

- **360° tours.** Rights remain `UNCONFIRMED` in `src/lib/panorama-sources.ts`.
  Do not publish, embed or link them without separate authorisation.
- **Films.** Remain unpublished (`src/lib/immersive-tours.ts`).
- **3D models** are Aarvasa's own reconstructions, governed separately by
  `PUBLIC_MODEL_APPROVALS`.

## Other media

| Asset | Status |
| --- | --- |
| Partner logos (`public/images/partners`) | Unconfirmed: owner to confirm each relationship |
| Aaradhyam layout plan | Supplied developer drawing; written confirmation not on file |
| Unsplash photographs (About page) | Unsplash License |

Earlier copies of withdrawn or restored media remain in Git history; this
repository is public.
