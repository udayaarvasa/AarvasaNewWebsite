import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/entitlements/route-guard";
import type { Capability } from "@/lib/entitlements/capabilities";

/**
 * POST /api/studio/jobs — start an immersive reconstruction or processing job.
 *
 * This is an expensive boundary: each job kind maps to GPU/compute time, so the
 * entitlement is verified here, server-side, before anything is queued. Calling
 * this endpoint directly with curl gets the same answer as clicking the button,
 * because the button is not what is being checked.
 *
 * No processing backend is wired yet. The route deliberately reports that
 * plainly (501) AFTER the entitlement check, so the security boundary is real
 * and testable today and the worker can be attached later without changing it.
 */

/** Job kind → the capability it consumes. One place, so pricing maps cleanly. */
const JOB_CAPABILITY = {
  MODEL_FROM_VIDEO: "CREATE_3D",
  MODEL_FROM_PHOTOS: "CREATE_3D",
  SPLAT_RECONSTRUCTION: "CREATE_SPLAT",
  PANORAMA_PROCESSING: "CREATE_360",
  MEDIA_OPTIMIZATION: "PROCESS_MEDIA",
} as const satisfies Record<string, Capability>;

type JobKind = keyof typeof JOB_CAPABILITY;

const BodySchema = z.object({
  kind: z.enum(Object.keys(JOB_CAPABILITY) as [JobKind, ...JobKind[]]),
  mediaAssetId: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid job request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // The capability required depends on what is being asked for.
  const guard = await requireCapability(req, JOB_CAPABILITY[parsed.data.kind]);
  if (!guard.ok) return guard.response;

  /* Entitlement satisfied. There is no reconstruction worker yet, and inventing
     a queued job id would imply work is happening that is not. */
  return NextResponse.json(
    {
      success: false,
      error: "Immersive processing is not available yet.",
      reason: "PROCESSING_UNAVAILABLE",
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
