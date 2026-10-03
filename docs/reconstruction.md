# Photo/video → 3D: the processor contract

No reconstruction engine is connected to any Aarvasa deployment. This document
is what a future GPU worker has to satisfy, and the reason nothing above it has
to change when one appears.

`getReconstructionProcessor()` returns `null`, so every caller reports
`PROCESSOR_NOT_CONFIGURED`. That is deliberately not a stub: a stub that
accepted jobs would produce queue entries, a progress bar and eventually a
"result" for work that never ran.

## What already works, and is not part of the engine

- **Coverage measurement.** `src/lib/media/coverage-analysis.ts` measures blur,
  duplicates, cuts and parallax from decoded frames. It is pure and tested.
- **The gate.** `assessCoverage()` turns those numbers into a verdict and
  capture guidance.
- **Everything downstream.** Upload, entitlement, ownership, the processing
  queue, the review step, publication, the CDN and the PlayCanvas viewer are all
  built against `MediaAsset` and do not know reconstruction exists. A produced
  GLB is processed exactly like a hand-uploaded one.

So the engine's job is narrow: take a source, return a file.

## The interface

`ReconstructionProcessor` in `src/lib/media/reconstruction.ts`:

| Member | Purpose |
| --- | --- |
| `engine` | Identity recorded on the asset, e.g. `colmap-3.11+openmvs-2.3` |
| `measure(request)` | Coverage of the **arrived** bytes. Never the client's numbers |
| `submit(request)` | Start a job; returns a `jobId` and a stage |
| `status(jobId)` | Poll until `READY` or `FAILED` |
| `collect(jobId)` | The finished artefact |

### Inputs (`ReconstructionRequest`)

| Field | Why the worker needs it |
| --- | --- |
| `mediaAssetId` | The asset, and the `{mediaId}` segment of every key it writes |
| `kind` | `MESH` → GLB, `SPLAT` → SOG |
| `sourceKey` | Private ingest key of the submitted photographs or video |
| `subject` | `PROJECT` slug or `PROPERTY` id, so the output lands where the source was submitted |
| `ownerId` | **The uploader.** An admin starting a job on someone else's upload must not end up owning the result |
| `config` | Timeout, maximum source size, sampling rate, triangle budget |

The worker never sees a session, a cookie or an entitlement record. By the time
a job exists, the routes that created it have already answered those questions.

### Output (`ReconstructionResult`)

`outputKey`, `format` (`GLB` or `SOG`), `sha256`, `sizeBytes`, `provenance`, and
`metadata` carrying the engine identity, duration, frames used, the worker's own
`CoverageStats`, and triangle or gaussian counts.

`provenance` is typed as the literal `"AARVASA_RECONSTRUCTION"`. A machine-made
model of a building is not an official developer asset, and the type makes that
claim unexpressible rather than merely discouraged. `OFFICIAL_MODEL` is only
ever set by a reviewer confirming a file the developer supplied.

## The order of operations

`RECONSTRUCTION_WORKER_CONTRACT` holds this as data, and a test asserts the
ordering, because the order *is* the safety property:

1. Claim the asset (`PROCESSING`) through the existing lifecycle.
2. Refuse a source larger than `config.maxSourceBytes` **without downloading it**.
3. `measure()` the arrived bytes.
4. `assessCoverage()`. If insufficient → `INSUFFICIENT_COVERAGE` with its
   guidance, and **stop**. No job is created and nothing is billed.
5. `submit()`, then poll `status()` within `config.timeoutSeconds`.
6. `collect()`, verify the SHA-256 against the downloaded bytes, reject a
   mismatch as a failure.
7. Write the output to the ingest bucket and hand it to the ordinary pipeline.
8. The asset follows the normal path: `PENDING_REVIEW`, a reviewer, publication.
   **Reconstruction never publishes.**

Measuring after submitting would mean paying for GPU time on material that
cannot produce geometry. Recording before verifying would let a truncated
download become a published model.

## Client measurements are advisory

The browser may measure and warn — it is useful to tell someone their footage is
unusable before a long upload — but nothing is decided by it. It is
attacker-controlled, and `measure()` runs again on what actually arrived. The
worker's verdict is the only one that counts.

## Cost control

`RECONSTRUCTION_DEFAULTS` is fixed by the deployment, not requested by the
caller: 4 fps sampling, a 1-hour timeout, a 2 GB source ceiling and a 300k
triangle budget. An unbounded GPU endpoint behind an authenticated route is
still an unbounded GPU endpoint. Entitlement, authentication, ownership, the
retry cap and the processing lease are all enforced by the existing pipeline and
are unchanged.

## What a deployment must provide

`RECONSTRUCTION_INFRASTRUCTURE` records this in code. In short: a container on
GPU compute (ECS/EC2/Batch, or a hosted reconstruction API) with 16 GB+ VRAM,
32 GB RAM, 50 GB scratch, ffmpeg, COLMAP and a dense-mesh stage, and up to four
hours per job.

The existing processing Lambda cannot host it: arm64 Node, no GPU, no ffmpeg
binary, a 15-minute ceiling. The queue, the worker contract and the MediaAsset
lifecycle are reusable; the compute is not.

## REEF

The supplied REEF material cannot support reconstruction. Measured with the real
analyser:

| Material | Mean baseline | Cuts/min | Verdict |
| --- | --- | --- | --- |
| REEF Brand Film | 0.80° | 24.3 | `NO_PARALLAX`, `TOO_MANY_CUTS` |
| REEF 996 Gamified VR Walkthrough | 0.28° | 5.1 | `NO_PARALLAX` |
| REEF 1000 Project Update, June 2026 | 0.53° | 4.1 | `NO_PARALLAX` |

The threshold is 1.5°. All three pass resolution, blur and duplicate checks,
which is what makes the refusals credible rather than blanket — the footage is
well shot, it is simply shot for film, not for photogrammetry.

For future REEF work, any of these would do:

- an official GLB or glTF from the developer (becomes `OFFICIAL_MODEL` on review);
- one continuous take that **arcs around** the building rather than pushing
  towards it, at 720p or better, with no cuts;
- a still-image capture of the same shape — 40+ frames from genuinely different
  angles, with overlap between neighbours.
