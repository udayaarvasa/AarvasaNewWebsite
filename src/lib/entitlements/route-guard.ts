import "server-only";

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-context";
import { checkCapability } from "./service";
import type { Capability } from "./capabilities";

/**
 * Entitlement guard for route handlers.
 *
 * Returns either the caller (allowed) or a ready Response (denied). Written as
 * a value rather than a thrown error so a handler cannot accidentally swallow
 * the denial in a catch-all try/except and continue.
 *
 * Identity is read from the request's verified session here — never from a
 * body field, header or query parameter naming a user.
 */
export type GuardResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; response: NextResponse };

export async function requireCapability(
  req: Request,
  capability: Capability,
): Promise<GuardResult> {
  const user = await getAuthUser(req);
  const decision = await checkCapability(user?.id, capability);

  if (decision.allowed) {
    return { ok: true, userId: user!.id, role: user!.role };
  }

  // 401 to sign in, 402 to activate a plan. `capability` is echoed so the UI
  // can name what is locked; `reason` is a stable code, not internal detail.
  return {
    ok: false,
    response: NextResponse.json(
      {
        success: false,
        error: decision.message,
        reason: decision.reason,
        capability,
      },
      {
        status: decision.reason === "UNAUTHENTICATED" ? 401 : 402,
        headers: { "Cache-Control": "no-store" },
      },
    ),
  };
}
