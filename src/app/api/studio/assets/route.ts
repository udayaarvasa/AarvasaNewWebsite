import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-context";
import { mediaFeaturesResponse } from "@/lib/media-features";

/**
 * GET /api/studio/assets — the caller's own immersive media.
 *
 * Scoped by the verified session, never by a parameter. There is deliberately
 * no `userId` query option: a route that accepts one is a route someone will
 * eventually call with a different id.
 *
 * Uploads are private from the moment they exist and stay that way until they
 * are explicitly published, so this returns the caller's assets at every
 * lifecycle stage — including ones that failed — while exposing none of them to
 * anyone else. Internal diagnostics (processingError, storage keys) are not
 * included; the failure code maps to a public message instead.
 *
 * No entitlement is required to look at your own library. Creating and
 * publishing are the premium operations, and they are gated at their own
 * endpoints.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gated = mediaFeaturesResponse();
  if (gated) return gated;

  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const assets = await prisma.mediaAsset
    .findMany({
      where: { uploadedById: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        format: true,
        status: true,
        title: true,
        altText: true,
        sizeBytes: true,
        sourceMimeType: true,
        failureCode: true,
        createdAt: true,
        publishedAt: true,
        subjectType: true,
        projectSlug: true,
        propertyId: true,
      },
    })
    .catch(() => []);

  return NextResponse.json(
    {
      success: true,
      assets: assets.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        publishedAt: a.publishedAt?.toISOString() ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
