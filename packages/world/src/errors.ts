/**
 * World Protocol Errors
 *
 * Typed error codes for the World Protocol.
 */

/**
 * World error codes
 */
export type WorldErrorCode =
  // Actor errors
  | "ACTOR_NOT_REGISTERED"
  | "ACTOR_ALREADY_REGISTERED"
  | "UNBOUND_ACTOR"

  // Proposal errors
  | "PROPOSAL_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "PROPOSAL_ALREADY_EXISTS"
  | "PROPOSAL_ALREADY_DECIDED"

  // World errors
  | "WORLD_NOT_FOUND"
  | "INVALID_BASE_WORLD"
  | "GENESIS_ALREADY_EXISTS"
  | "NO_GENESIS"

  // Lineage errors
  | "LINEAGE_CYCLE_DETECTED"
  | "CYCLE_DETECTED"
  | "INVALID_EDGE"
  | "WORLD_ALREADY_EXISTS"
  | "PARENT_NOT_FOUND"
  | "INVALID_GENESIS"

  // Decision errors
  | "DECISION_NOT_FOUND"
  | "DECISION_ALREADY_EXISTS"

  // Authority errors
  | "AUTHORITY_EVALUATION_ERROR"
  | "UNKNOWN_AUTHORITY_KIND"

  // HITL errors
  | "HITL_TIMEOUT"
  | "HITL_NOT_PENDING"
  | "INVALID_HITL_DECISION"

  // Host integration errors
  | "HOST_EXECUTION_ERROR"
  | "HOST_NOT_CONFIGURED"

  // General errors
  | "INVALID_ARGUMENT"
  | "INTERNAL_ERROR";

/**
 * World Protocol Error
 */
export class WorldError extends Error {
  readonly code: WorldErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: WorldErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "WorldError";
    this.code = code;
    this.details = details;

    // Capture stack trace in V8 environments
    const ErrorWithCaptureStackTrace = Error as typeof Error & {
      captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
    };
    if (typeof ErrorWithCaptureStackTrace.captureStackTrace === "function") {
      ErrorWithCaptureStackTrace.captureStackTrace(this, WorldError);
    }
  }
}

/**
 * Create a WorldError
 */
export function createWorldError(
  code: WorldErrorCode,
  message: string,
  details?: Record<string, unknown>
): WorldError {
  return new WorldError(code, message, details);
}

/**
 * Type guard for WorldError
 */
export function isWorldError(error: unknown): error is WorldError {
  return error instanceof WorldError;
}

// ============================================================================
// Common Error Factories
// ============================================================================

/**
 * Actor not registered error
 */
export function actorNotRegistered(actorId: string): WorldError {
  return createWorldError(
    "ACTOR_NOT_REGISTERED",
    `Actor '${actorId}' is not registered`,
    { actorId }
  );
}

/**
 * Actor already registered error
 */
export function actorAlreadyRegistered(actorId: string): WorldError {
  return createWorldError(
    "ACTOR_ALREADY_REGISTERED",
    `Actor '${actorId}' is already registered`,
    { actorId }
  );
}

/**
 * Unbound actor error
 */
export function unboundActor(actorId: string): WorldError {
  return createWorldError(
    "UNBOUND_ACTOR",
    `Actor '${actorId}' has no authority binding`,
    { actorId }
  );
}

/**
 * Proposal not found error
 */
export function proposalNotFound(proposalId: string): WorldError {
  return createWorldError(
    "PROPOSAL_NOT_FOUND",
    `Proposal '${proposalId}' not found`,
    { proposalId }
  );
}

/**
 * Invalid state transition error
 */
export function invalidStateTransition(
  proposalId: string,
  from: string,
  to: string
): WorldError {
  return createWorldError(
    "INVALID_STATE_TRANSITION",
    `Invalid state transition from '${from}' to '${to}' for proposal '${proposalId}'`,
    { proposalId, from, to }
  );
}

/**
 * World not found error
 */
export function worldNotFound(worldId: string): WorldError {
  return createWorldError(
    "WORLD_NOT_FOUND",
    `World '${worldId}' not found`,
    { worldId }
  );
}

/**
 * Invalid base world error
 */
export function invalidBaseWorld(worldId: string): WorldError {
  return createWorldError(
    "INVALID_BASE_WORLD",
    `Base world '${worldId}' does not exist`,
    { worldId }
  );
}

/**
 * Genesis already exists error
 */
export function genesisAlreadyExists(existingId: string): WorldError {
  return createWorldError(
    "GENESIS_ALREADY_EXISTS",
    `Genesis world already exists: '${existingId}'`,
    { existingId }
  );
}

/**
 * No genesis error
 */
export function noGenesis(): WorldError {
  return createWorldError(
    "NO_GENESIS",
    "No genesis world exists. Create genesis first."
  );
}

/**
 * Lineage cycle detected error
 */
export function lineageCycleDetected(from: string, to: string): WorldError {
  return createWorldError(
    "LINEAGE_CYCLE_DETECTED",
    `Adding edge from '${from}' to '${to}' would create a cycle`,
    { from, to }
  );
}

/**
 * HITL timeout error
 */
export function hitlTimeout(proposalId: string, timeout: number): WorldError {
  return createWorldError(
    "HITL_TIMEOUT",
    `HITL decision timed out after ${timeout}ms for proposal '${proposalId}'`,
    { proposalId, timeout }
  );
}

/**
 * Host execution error
 */
export function hostExecutionError(
  proposalId: string,
  hostError: string
): WorldError {
  return createWorldError(
    "HOST_EXECUTION_ERROR",
    `Host execution failed for proposal '${proposalId}': ${hostError}`,
    { proposalId, hostError }
  );
}
