/**
 * Who may read /api/diag.
 *
 * In production the endpoint reported to anyone whether each secret was set
 * and whether the database was reachable — reconnaissance for free. It now
 * answers 404 in production unless the caller presents AUTH_DIAG_KEY (which is
 * not set in Amplify, so it is off there). Development keeps the summary.
 */
export type DiagAccess = "none" | "summary" | "detailed";

export function diagAccess(input: { nodeEnv: string | undefined; key: string | null; diagKey: string | undefined }): DiagAccess {
  const keyMatches = Boolean(input.diagKey) && input.key === input.diagKey;
  if (keyMatches) return "detailed";
  return input.nodeEnv === "production" ? "none" : "summary";
}
