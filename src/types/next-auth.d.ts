// Removed Prisma type imports for local build compatibility
import NextAuth, { type DefaultSession } from "next-auth"

export type ExtendedUser = DefaultSession["user"] & {
  id: string
  role: any
}

declare module "next-auth" {
  interface Session {
    user: ExtendedUser
  }
}
