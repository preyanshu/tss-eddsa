/**
 * Multi-Party EdDSA - Main Package Entry Point
 *
 * This package provides classes for implementing threshold EdDSA signatures
 * using Multi-Party Computation (MPC).
 *
 * @example
 * // Import all classes
 * import { MPCService, CoordinatorService, MPCClient } from 'multi-party-eddsa';
 *
 * // Or import individually
 * import MPCService from 'multi-party-eddsa/MPCService';
 * import CoordinatorService from 'multi-party-eddsa/CoordinatorService';
 */

export { MPCService } from "./services/mpc_service";
export { CoordinatorService } from "./services/coordinator_service";
export { MPCClient } from "./client/mpc_client";
export * from "./types";
export * from "./errors";
