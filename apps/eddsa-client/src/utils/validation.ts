import { ValidationError } from "../errors";

/**
 * Validation utilities for MPC operations
 */

/**
 * Validate threshold value
 * @throws {ValidationError} if threshold is invalid
 */
export function validateThreshold(
  threshold: number,
  totalParties?: number
): void {
  if (threshold < 2) {
    throw new ValidationError(
      `Threshold must be at least 2. Got ${threshold}. This is required because we pass t-1 to Rust, and t-1 must be >= 1.`
    );
  }

  if (totalParties !== undefined && threshold > totalParties) {
    throw new ValidationError(
      `Threshold (${threshold}) cannot be greater than total parties (${totalParties})`
    );
  }
}

/**
 * Validate that signing parties count meets threshold requirement
 * @throws {ValidationError} if signing parties count is insufficient
 */
export function validateSigningParties(
  signingPartiesCount: number,
  threshold: number,
  totalParties?: number
): void {
  if (signingPartiesCount < threshold) {
    throw new ValidationError(
      `Need at least ${threshold} signing parties for threshold=${threshold}, got ${signingPartiesCount}`
    );
  }

  if (totalParties !== undefined && signingPartiesCount > totalParties) {
    throw new ValidationError(
      `Cannot have more signing parties (${signingPartiesCount}) than total parties (${totalParties})`
    );
  }
}
