/**
 * Custom error classes for MPC operations
 */

/**
 * Base error class for all MPC-related errors
 */
export class MPCError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends MPCError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown when a session is not properly initialized
 */
export class SessionError extends MPCError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown when a service is not properly initialized
 */
export class ServiceError extends MPCError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown when a party is not found or invalid
 */
export class PartyError extends MPCError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown when required state is missing
 */
export class StateError extends MPCError {
  constructor(message: string) {
    super(message);
  }
}
