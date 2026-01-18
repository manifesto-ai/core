/**
 * Bridge Errors
 *
 * Defines error types for the Bridge package.
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Bridge error codes
 */
export type BridgeErrorCode =
  | "PROJECTION_NOT_FOUND"
  | "PROJECTION_ALREADY_REGISTERED"
  | "NO_ACTOR_CONFIGURED"
  | "NO_WORLD_CONFIGURED"
  | "NO_SNAPSHOT_AVAILABLE"
  | "DISPATCH_FAILED"
  | "PROJECTION_ERROR"
  | "INVALID_ARGUMENT";

// ============================================================================
// Bridge Error
// ============================================================================

/**
 * Bridge error class
 */
export class BridgeError extends Error {
  readonly code: BridgeErrorCode;

  constructor(code: BridgeErrorCode, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;

    // Ensure instanceof works correctly
    Object.setPrototypeOf(this, BridgeError.prototype);
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a BridgeError
 */
export function createBridgeError(
  code: BridgeErrorCode,
  message: string
): BridgeError {
  return new BridgeError(code, message);
}

/**
 * Projection not found error
 */
export function projectionNotFound(projectionId: string): BridgeError {
  return createBridgeError(
    "PROJECTION_NOT_FOUND",
    `Projection not found: ${projectionId}`
  );
}

/**
 * Projection already registered error
 */
export function projectionAlreadyRegistered(projectionId: string): BridgeError {
  return createBridgeError(
    "PROJECTION_ALREADY_REGISTERED",
    `Projection already registered: ${projectionId}`
  );
}

/**
 * No actor configured error
 */
export function noActorConfigured(): BridgeError {
  return createBridgeError(
    "NO_ACTOR_CONFIGURED",
    "No actor configured. Provide an actor or set a default actor."
  );
}

/**
 * No world configured error
 */
export function noWorldConfigured(): BridgeError {
  return createBridgeError(
    "NO_WORLD_CONFIGURED",
    "No world configured. Provide a ManifestoWorld instance."
  );
}

/**
 * No snapshot available error
 */
export function noSnapshotAvailable(): BridgeError {
  return createBridgeError(
    "NO_SNAPSHOT_AVAILABLE",
    "No snapshot available. Create a genesis world first."
  );
}

/**
 * Dispatch failed error
 */
export function dispatchFailed(reason: string): BridgeError {
  return createBridgeError("DISPATCH_FAILED", `Dispatch failed: ${reason}`);
}

/**
 * Projection error
 */
export function projectionError(
  projectionId: string,
  reason: string
): BridgeError {
  return createBridgeError(
    "PROJECTION_ERROR",
    `Projection '${projectionId}' error: ${reason}`
  );
}

/**
 * Invalid argument error
 */
export function invalidArgument(message: string): BridgeError {
  return createBridgeError("INVALID_ARGUMENT", message);
}
