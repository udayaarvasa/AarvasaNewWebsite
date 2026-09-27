/**
 * Named premium capabilities.
 *
 * These are the commercial boundary: everything here costs Aarvasa real compute
 * or storage, so each one is checked server-side before any work begins.
 * Browsing, searching, filtering, comparing and viewing published media are
 * deliberately NOT here — public discovery stays free.
 *
 * Capabilities are names, not prices. Packages map onto them later; nothing in
 * this file assumes what a plan costs or contains.
 *
 * Pure module: no Prisma, no I/O, no server-only imports, so the rules below
 * can be asserted by a test without a database.
 */

export const ENTITLEMENT_CAPABILITIES = [
  /** Turn supplied imagery or video into a 3D model. */
  "CREATE_3D",
  /** Produce a Gaussian splat reconstruction. */
  "CREATE_SPLAT",
  /** Build a 360° experience where processing is required. */
  "CREATE_360",
  /** Run the media processing pipeline over an uploaded original. */
  "PROCESS_MEDIA",
  /** Make a creator-generated immersive asset publicly visible. */
  "PUBLISH_IMMERSIVE",
  /** Enable AR presentation of a published asset. */
  "AR_PUBLISH",
  /** Enable VR presentation of a published asset. */
  "VR_PUBLISH",
] as const;

export type Capability = (typeof ENTITLEMENT_CAPABILITIES)[number];

const CAPABILITY_SET: ReadonlySet<string> = new Set(ENTITLEMENT_CAPABILITIES);

/** Whether a string names a capability this build knows about. */
export function isCapability(value: string): value is Capability {
  return CAPABILITY_SET.has(value);
}

/**
 * Keep only recognised capability names.
 *
 * Stored capability arrays are filtered through this on read, so a name that
 * was removed from the product — or was never valid — cannot authorize
 * anything just because it survives in a database row.
 */
export function sanitizeCapabilities(values: readonly string[]): Capability[] {
  return values.filter(isCapability);
}

/** Human labels for the locked-state UI. Copy only; grants nothing. */
export const CAPABILITY_LABELS: Readonly<Record<Capability, string>> = {
  CREATE_3D: "Create a 3D model",
  CREATE_SPLAT: "Create a Gaussian splat",
  CREATE_360: "Create a 360° experience",
  PROCESS_MEDIA: "Process uploaded media",
  PUBLISH_IMMERSIVE: "Publish an immersive asset",
  AR_PUBLISH: "Publish in AR",
  VR_PUBLISH: "Publish in VR",
};

/** Why a check failed. Returned to the client; carries no internal detail. */
export type DenialReason =
  | "UNAUTHENTICATED"
  | "NO_ENTITLEMENT"
  | "INACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "CAPABILITY_NOT_INCLUDED";

export const DENIAL_MESSAGES: Readonly<Record<DenialReason, string>> = {
  UNAUTHENTICATED: "Sign in to use immersive creation.",
  NO_ENTITLEMENT: "Immersive creation is available with an Aarvasa Media Studio plan.",
  INACTIVE: "Your Media Studio plan is not active.",
  EXPIRED: "Your Media Studio plan has expired.",
  SUSPENDED: "Your Media Studio plan is suspended.",
  CAPABILITY_NOT_INCLUDED: "Your current plan does not include this capability.",
};
