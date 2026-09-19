/**
 * Error classes that decide retry behaviour. Anything a port throws that is not
 * one of these is treated as a temporary worker failure (retryable, bounded by
 * PROCESSING_POLICY.maxAttempts).
 */

/** Transient: S3 5xx/throttling/network, a conditional-write conflict, a database hiccup. */
export class RetryableProcessingError extends Error {
  override readonly name = "RetryableProcessingError";
}

/**
 * Permanent: an immutable published key already holds different bytes. Keys are
 * content-addressed, so this means a bug or tampering, never a retry candidate.
 */
export class ImmutableObjectConflictError extends Error {
  override readonly name = "ImmutableObjectConflictError";
}
