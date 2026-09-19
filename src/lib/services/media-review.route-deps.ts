import { prisma } from "@/lib/prisma"
import { getReviewAccess } from "@/lib/media/published-storage"
import type { MediaReviewDependencies } from "./media-review.service"
import { createPrismaReviewStore } from "./media-review.store"

/** Production wiring for the admin media review routes. */
export function mediaReviewRouteDeps(route: string): MediaReviewDependencies {
  return {
    store: createPrismaReviewStore(prisma),
    getReviewAccess: () => getReviewAccess(),
    now: () => new Date(),
    log: (message, context) => console.error(`[${route}] ${message}`, context),
  }
}

export const NO_STORE = { "Cache-Control": "no-store" } as const
