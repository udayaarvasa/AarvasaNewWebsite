import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-context";
import { requireCapability } from "@/lib/entitlements/route-guard";
import type { Capability } from "@/lib/entitlements/capabilities";
import {
  assessCoverage,
  getReconstructionProcessor,
  RECONSTRUCTION_DEFAULTS,
  type CoverageStats,
} from "@/lib/media/reconstruction";

/**
 * POST /api/studio/jobs — start an immersive reconstruction or processing job.
 *
 * Four gates, in this order, all server-side:
 *
 *   1. Entitlement — the capability the requested job kind consumes.
 *   2. Ownership   — the asset must belong to the caller (or they are admin).
 *   3. Coverage    — for reconstruction, whether the material can support one
 *                    at all. Refusing here is the difference between telling
 *                    someone what to re-shoot and billing them for a job that
 *                    was never going to produce geometry.
 *   4. Processor   — whether an engine is actually configured.
 *
 * Order matters: entitlement first so an unpaid caller learns nothing about
 * which assets exist, and coverage before the processor so useful feedback is
 * given even while no engine is attached.
 *
 * Nothing here fabricates a job id, a queue position or a progress percentage.
 */

/** Job kind → the capability it consumes. One table, so pricing maps cleanly. */
const JOB_CAPABILITY = {
  MODEL_FROM_VIDEO: "CREATE_3D",
  MODEL_FROM_PHOTOS: "CREATE_3D",
  SPLAT_RECONSTRUCTION: "CREATE_SPLAT",
  PANORAMA_PROCESSING: "CREATE_360",
  MEDIA_OPTIMIZATION: "PROCESS_MEDIA",
} as const satisfies Record<string, Capability>;

type JobKind = keyof typeof JOB_CAPABILITY;

/** The kinds that need a camera to have moved around the subject. */
const RECONSTRUCTION_KINDS: ReadonlySet<string> = new Set([
  "MODEL_FROM_VIDEO",
  "MODEL_FROM_PHOTOS",
  "SPLAT_RECONSTRUCTION",
]);

const StatsSchema = z.object({
  frameCount: z.number().int().nonnegative(),
  minEdgePx: z.number().int().nonnegative(),
  shotCount: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative().nullable(),
  meanBaselineDegrees: z.number().nonnegative(),
  blurredFraction: z.number().min(0).max(1),
  duplicateFraction: z.number().min(0).max(1),
});

const BodySchema = z.object({
  kind: z.enum(Object.keys(JOB_CAPABILITY) as [JobKind, ...JobKind[]]),
  mediaAssetId: z.string().min(1).max(64),
  /**
   * Measurements from the client-side pre-flight, used only to fail fast with
   * useful guidance. They are not trusted: the worker re-measures the actual
   * file before spending anything, because a caller could otherwise claim
   * perfect coverage to force a job through.
   */
  coverage: StatsSchema.optional(),
});

const noStore = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400, headers: noStore });
  }
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid job request" }, { status: 400, headers: noStore });
  }
  const { kind, mediaAssetId, coverage } = parsed.data;

  // 1 — entitlement.
  const guard = await requireCapability(req, JOB_CAPABILITY[kind]);
  if (!guard.ok) return guard.response;

  // 2 — ownership. A plan is not access to someone else's media.
  const user = await getAuthUser(req);
  const asset = await prisma.mediaAsset
    .findUnique({
      where: { id: mediaAssetId },
      select: { id: true, uploadedById: true, status: true, sourceKey: true, subjectType: true, projectSlug: true, propertyId: true },
    })
    .catch(() => null);

  const owns = asset && user && asset.uploadedById === user.id;
  if (!asset || (!owns && user?.role !== "ADMIN")) {
    // Not yours and not found are the same answer: existence is not disclosed.
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404, headers: noStore });
  }

  // 3 — coverage, for the kinds that need parallax.
  if (RECONSTRUCTION_KINDS.has(kind) && coverage) {
    const verdict = assessCoverage(coverage as CoverageStats);
    if (!verdict.sufficient) {
      return NextResponse.json(
        {
          success: false,
          reason: "INSUFFICIENT_COVERAGE",
          error: "This material cannot support a reconstruction.",
          problems: verdict.problems,
          guidance: verdict.guidance,
        },
        { status: 422, headers: noStore },
      );
    }
  }

  // 4 — engine. None is configured, and saying so is the honest answer.
  const processor = getReconstructionProcessor();
  if (!processor) {
    return NextResponse.json(
      {
        success: false,
        reason: "PROCESSOR_NOT_CONFIGURED",
        error:
          "Reconstruction is not available yet. No processing engine is connected to this environment.",
      },
      { status: 501, headers: noStore },
    );
  }

  /* The subject travels with the job so the produced asset lands on the project
     or property the source was submitted for, and `ownerId` is the uploader, not
     the caller: an admin starting a job on someone else's upload must not end up
     owning the result. */
  const subject =
    asset.subjectType === "PROJECT"
      ? ({ type: "PROJECT", projectSlug: asset.projectSlug ?? "" } as const)
      : ({ type: "PROPERTY", propertyId: asset.propertyId ?? "" } as const);
  if ((subject.type === "PROJECT" ? subject.projectSlug : subject.propertyId) === "") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404, headers: noStore });
  }

  const handle = await processor.submit({
    mediaAssetId: asset.id,
    kind: kind === "SPLAT_RECONSTRUCTION" ? "SPLAT" : "MESH",
    sourceKey: asset.sourceKey,
    subject,
    ownerId: asset.uploadedById ?? "",
    config: RECONSTRUCTION_DEFAULTS,
  });
  return NextResponse.json({ success: true, jobId: handle.jobId, stage: handle.stage }, { headers: noStore });
}
