/** Google is authoritative for Gmail and Google Workspace mailboxes. */
export function googleControlsEmail(email: string, verified: unknown, hostedDomain: unknown): boolean {
  return verified === true && (email.toLowerCase().endsWith("@gmail.com") ||
    (typeof hostedDomain === "string" && hostedDomain.trim().length > 0))
}
