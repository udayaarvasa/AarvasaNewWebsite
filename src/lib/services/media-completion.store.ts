import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { CompletionAuthorization, UploadCompletionStore } from "./media-completion.service";

/**
 * Authorization as update predicates. A non-admin's update only matches while they
 * are still the uploader and the property's current owner, so the check and the
 * write cannot be separated by an ownership change. (An ADMIN demoted in the
 * milliseconds between the role read and the update is the accepted residual.)
 */
function authorizationWhere(authorization: CompletionAuthorization): Prisma.MediaAssetWhereInput {
  if (authorization.admin) return {};
  return { subjectType: "PROPERTY", uploadedById: authorization.userId, property: { is: { ownerId: authorization.userId } } };
}

/** Prisma implementation of the upload-completion data store (see media-completion.service.ts). */
export const prismaUploadCompletionStore: UploadCompletionStore = {
  findUser: (id) => prisma.user.findUnique({ where: { id }, select: { id: true, role: true } }),

  findMediaAsset: (id) =>
    prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        id: true,
        subjectType: true,
        propertyId: true,
        projectSlug: true,
        kind: true,
        status: true,
        sourceKey: true,
        sourceSizeBytes: true,
        sourceMimeType: true,
        sourceChecksumSha256: true,
        uploadedById: true,
        createdAt: true,
      },
    }),

  findPropertyOwner: (propertyId) => prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } }),

  async transitionToProcessing(id, verified, authorization) {
    const { count } = await prisma.mediaAsset.updateMany({
      where: {
        id,
        status: "UPLOADED",
        sourceKey: verified.sourceKey,
        sourceSizeBytes: verified.sourceSizeBytes,
        sourceMimeType: verified.sourceMimeType,
        sourceChecksumSha256: verified.sourceChecksumSha256,
        ...authorizationWhere(authorization),
      },
      data: { status: "PROCESSING", processingError: null },
    });
    return count;
  },

  async markFailed(id, sourceKey, processingError, authorization) {
    const { count } = await prisma.mediaAsset.updateMany({
      where: { id, status: "UPLOADED", sourceKey, ...authorizationWhere(authorization) },
      data: { status: "FAILED", processingError },
    });
    return count;
  },
};
