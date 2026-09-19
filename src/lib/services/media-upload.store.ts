import { prisma } from "@/lib/prisma";
import type { UploadIntentStore } from "./media-upload.service";

/** Prisma implementation of the upload-intent data store (see media-upload.service.ts). */
export const prismaUploadIntentStore: UploadIntentStore = {
  findUser: (id) => prisma.user.findUnique({ where: { id }, select: { id: true, role: true } }),

  findProperty: (id) => prisma.property.findUnique({ where: { id }, select: { id: true, ownerId: true } }),

  countRecentUploadIntents: (uploadedById, since) => prisma.mediaAsset.count({ where: { uploadedById, createdAt: { gte: since } } }),

  async createUploadedMediaAsset(data) {
    await prisma.mediaAsset.create({ data, select: { id: true } });
  },

  async markUploadIntentFailed(id, processingError) {
    await prisma.mediaAsset.updateMany({
      where: { id, status: "UPLOADED" },
      data: { status: "FAILED", processingError, failureCode: "UPLOAD_AUTHORIZATION_FAILED" },
    });
  },
};
