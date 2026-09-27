/**
 * Payment provider boundary.
 *
 * No provider is integrated. This file exists so that when one is — Razorpay is
 * the intended first — it slots in behind this interface without the Media
 * Studio, the processing pipeline, the viewers or the entitlement checks
 * needing to change.
 *
 * The shape encodes one non-negotiable rule: an entitlement is activated by
 * `verifyAndActivate` running on the server against a provider webhook or a
 * server-to-server confirmation. A browser reporting success is not evidence.
 * That is why `PaymentConfirmation` carries an opaque provider payload and a
 * signature for the adapter to verify, rather than an `isPaid` boolean.
 */

export type PaymentIntent = {
  /** Opaque package identifier. Prices and plans are deferred. */
  readonly planKey: string;
  readonly userId: string;
  readonly amountMinor: number;
  readonly currency: string;
};

/** What the provider hands back when an order is opened. */
export type ProviderOrder = {
  readonly providerOrderId: string;
  /** Anything the client SDK needs. Never treated as proof of payment. */
  readonly clientPayload: Record<string, unknown>;
};

/** A provider callback awaiting server-side verification. */
export type PaymentConfirmation = {
  readonly providerOrderId: string;
  readonly providerPaymentId: string;
  /** Verified against the provider's secret inside the adapter. */
  readonly signature: string;
  readonly rawBody: string;
};

export type VerificationResult =
  | { readonly verified: true; readonly amountMinor: number; readonly currency: string }
  | { readonly verified: false; readonly reason: string };

/**
 * Implemented per provider (RazorpayAdapter, later). Implementations live in
 * their own module and are the only place provider-specific code may appear.
 */
export interface PaymentProvider {
  readonly key: string;
  createOrder(intent: PaymentIntent): Promise<ProviderOrder>;
  /**
   * Verify a confirmation actually came from the provider and is for the order
   * claimed. Must perform real cryptographic verification against a secret held
   * server-side; must never return verified:true on client assertion alone.
   */
  verify(confirmation: PaymentConfirmation): Promise<VerificationResult>;
}

/**
 * No provider is registered. Returning null — rather than a stub that appears
 * to work — means any checkout attempt fails loudly instead of silently
 * pretending a payment path exists.
 */
export function getPaymentProvider(): PaymentProvider | null {
  return null;
}

/** Whether checkout can be offered at all. False until a provider is registered. */
export const paymentsAvailable = (): boolean => getPaymentProvider() !== null;
