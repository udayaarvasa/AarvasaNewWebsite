import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * The check every admin API runs before doing anything.
 *
 * The role is read from the database, not from the session token. A token's
 * role is stamped at sign-in and survives every refresh, so an admin who was
 * demoted — or an account that was deleted — would otherwise keep admin rights
 * until the session expired. The page proxy is a convenience redirect and is
 * not relied on here at all.
 */
export async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId)
    return { ok: false, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role !== "ADMIN")
    return { ok: false, response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) }

  return { ok: true, userId }
}
