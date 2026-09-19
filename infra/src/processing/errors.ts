/**
 * Error classes that decide retry behaviour. Anything a port throws that is not
 * one of these is treated as a temporary worker failure (retryable, bounded by
 * PROCESSING_POLICY.maxAttempts). Defined once with the S3 publisher
 * (src/lib/media/published-storage.ts) so `instanceof` holds across the worker
 * and the admin publication path.
 */
export { ImmutableObjectConflictError, RetryableProcessingError, ReviewCopyMissingError } from "../../../src/lib/media/published-storage";
