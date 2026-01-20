/**
 * Manifesto App Error Hierarchy
 *
 * @see SPEC §19 Error Hierarchy
 * @module
 */

// =============================================================================
// Base Error
// =============================================================================

/**
 * Base class for all Manifesto App errors.
 *
 * All App-specific errors extend this class and provide:
 * - A unique `code` for programmatic error handling
 * - A `timestamp` for when the error occurred
 * - An optional `cause` for error chaining
 */
export abstract class ManifestoAppError extends Error {
  abstract readonly code: string;
  readonly timestamp: number;
  readonly cause?: unknown;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now();
    this.cause = opts?.cause;

    // Maintains proper stack trace for where our error was thrown (V8 only)
    const ErrorWithStackTrace = Error as typeof Error & {
      captureStackTrace?: (target: object, constructorOpt?: Function) => void;
    };
    if (ErrorWithStackTrace.captureStackTrace) {
      ErrorWithStackTrace.captureStackTrace(this, this.constructor);
    }
  }
}

// =============================================================================
// Lifecycle Errors
// =============================================================================

/**
 * Thrown when an API is called before `app.ready()` completes.
 *
 * @see SPEC §5.6 READY-1
 */
export class AppNotReadyError extends ManifestoAppError {
  readonly code = "APP_NOT_READY" as const;

  constructor(apiName: string) {
    super(`Cannot call '${apiName}' before app.ready() completes`);
  }
}

/**
 * Thrown when an API is called after `app.dispose()` is called.
 *
 * @see SPEC §5.7 DISPOSE-1
 */
export class AppDisposedError extends ManifestoAppError {
  readonly code = "APP_DISPOSED" as const;

  constructor(apiName: string) {
    super(`Cannot call '${apiName}' after app.dispose()`);
  }
}

// =============================================================================
// Action Errors
// =============================================================================

/**
 * Thrown by `done()` when the action is rejected by Authority.
 *
 * @see SPEC §8.6 DONE-2
 */
export class ActionRejectedError extends ManifestoAppError {
  readonly code = "ACTION_REJECTED" as const;

  constructor(
    public readonly proposalId: string,
    public readonly reason?: string
  ) {
    super(
      reason
        ? `Action ${proposalId} rejected: ${reason}`
        : `Action ${proposalId} rejected by Authority`
    );
  }
}

/**
 * Thrown by `done()` when the action execution fails.
 *
 * @see SPEC §8.6 DONE-3
 */
export class ActionFailedError extends ManifestoAppError {
  readonly code = "ACTION_FAILED" as const;

  constructor(
    public readonly proposalId: string,
    public readonly errorCode: string,
    public readonly errorMessage: string,
    opts?: { cause?: unknown }
  ) {
    super(`Action ${proposalId} failed: ${errorMessage}`, opts);
  }
}

/**
 * Thrown by `done()` when the action fails during preparation phase.
 *
 * @see SPEC §8.6 DONE-4
 */
export class ActionPreparationError extends ManifestoAppError {
  readonly code = "ACTION_PREPARATION" as const;

  constructor(
    public readonly proposalId: string,
    public readonly errorCode: string,
    public readonly errorMessage: string,
    opts?: { cause?: unknown }
  ) {
    super(`Action ${proposalId} preparation failed: ${errorMessage}`, opts);
  }
}

/**
 * Thrown by `done()` or `result()` when timeout is exceeded.
 *
 * @see SPEC §8.6 DONE-5
 */
export class ActionTimeoutError extends ManifestoAppError {
  readonly code = "ACTION_TIMEOUT" as const;

  constructor(
    public readonly proposalId: string,
    public readonly timeoutMs: number
  ) {
    super(`Action ${proposalId} timed out after ${timeoutMs}ms`);
  }
}

/**
 * Thrown by `getActionHandle()` when proposalId is not found.
 *
 * @see SPEC §6.1
 */
export class ActionNotFoundError extends ManifestoAppError {
  readonly code = "ACTION_NOT_FOUND" as const;

  constructor(public readonly proposalId: string) {
    super(`Action with proposalId '${proposalId}' not found`);
  }
}

/**
 * Thrown when attempting to use a detached ActionHandle.
 *
 * @see SPEC §8.7 DETACH-2
 */
export class HandleDetachedError extends ManifestoAppError {
  readonly code = "HANDLE_DETACHED" as const;

  constructor(public readonly proposalId: string) {
    super(
      `ActionHandle ${proposalId} is detached. Use app.getActionHandle() to reattach.`
    );
  }
}

// =============================================================================
// Hook Errors
// =============================================================================

/**
 * Thrown when attempting to perform mutations directly in a hook callback.
 *
 * @see SPEC §11.3 HOOK-MUT-1
 */
export class HookMutationError extends ManifestoAppError {
  readonly code = "HOOK_MUTATION" as const;

  constructor(apiName: string, hookName: string) {
    super(
      `Cannot call '${apiName}' directly in '${hookName}' hook. Use ctx.enqueue() instead.`
    );
  }
}

// =============================================================================
// Service Errors
// =============================================================================

/**
 * Thrown when an effect handler is not found.
 *
 * @see SPEC §13.3 SVC-1, SVC-3
 */
export class MissingServiceError extends ManifestoAppError {
  readonly code = "MISSING_SERVICE" as const;

  constructor(public readonly effectType: string) {
    super(`No service handler registered for effect type '${effectType}'`);
  }
}

/**
 * Thrown in strict mode when a dynamic effect type is encountered.
 *
 * @see SPEC §13.3 SVC-5
 */
export class DynamicEffectTypeError extends ManifestoAppError {
  readonly code = "DYNAMIC_EFFECT" as const;

  constructor(public readonly effectType: string) {
    super(
      `Dynamic effect type '${effectType}' is not allowed in strict validation mode`
    );
  }
}

/**
 * Thrown when attempting to register a handler for a reserved effect type.
 *
 * @see SPEC §18.5 SYSGET-3
 */
export class ReservedEffectTypeError extends ManifestoAppError {
  readonly code = "RESERVED_EFFECT_TYPE" as const;

  constructor(public readonly effectType: string) {
    super(
      `Effect type '${effectType}' is reserved and cannot be overridden in services`
    );
  }
}

// =============================================================================
// System Action Errors
// =============================================================================

/**
 * Thrown when a disabled System Action is invoked.
 *
 * @see SPEC §17.9 SYS-5, SYS-5a
 */
export class SystemActionDisabledError extends ManifestoAppError {
  readonly code = "SYSTEM_ACTION_DISABLED" as const;

  constructor(public readonly actionType: string) {
    super(`System Action '${actionType}' is disabled`);
  }
}

/**
 * Thrown when a System Action is invoked via branch.act() or session.act().
 *
 * @see SPEC §17.8 SYS-INV-2, SYS-INV-3
 */
export class SystemActionRoutingError extends ManifestoAppError {
  readonly code = "SYSTEM_ACTION_ROUTING" as const;

  constructor(
    public readonly actionType: string,
    public readonly source: "branch" | "session"
  ) {
    super(
      `System Action '${actionType}' must be invoked via app.act(), not ${source}.act()`
    );
  }
}

// =============================================================================
// Memory Errors
// =============================================================================

/**
 * Thrown when memory operations are attempted when memory is disabled.
 *
 * @see SPEC §14.9 MEM-DIS-2, MEM-DIS-3
 */
export class MemoryDisabledError extends ManifestoAppError {
  readonly code = "MEMORY_DISABLED" as const;

  constructor(operation: string) {
    super(
      `Memory operation '${operation}' is not available because memory is disabled`
    );
  }
}

// =============================================================================
// Branch/World Errors
// =============================================================================

/**
 * Thrown when a branch is not found.
 *
 * @see SPEC §14.10 MEM-REC-5
 */
export class BranchNotFoundError extends ManifestoAppError {
  readonly code = "BRANCH_NOT_FOUND" as const;

  constructor(public readonly branchId: string) {
    super(`Branch '${branchId}' not found`);
  }
}

/**
 * Thrown when a world is not found.
 *
 * @see SPEC §9.2 CHECKOUT-3
 */
export class WorldNotFoundError extends ManifestoAppError {
  readonly code = "WORLD_NOT_FOUND" as const;

  constructor(public readonly worldId: string) {
    super(`World '${worldId}' not found`);
  }
}

/**
 * Thrown when attempting checkout to a world with different schemaHash.
 *
 * @see SPEC §9.2 CHECKOUT-1
 */
export class WorldSchemaHashMismatchError extends ManifestoAppError {
  readonly code = "SCHEMA_MISMATCH" as const;

  constructor(
    public readonly worldId: string,
    public readonly expectedSchemaHash: string,
    public readonly actualSchemaHash: string
  ) {
    super(
      `World '${worldId}' has schema '${actualSchemaHash}', expected '${expectedSchemaHash}'`
    );
  }
}

/**
 * Thrown when attempting checkout to a world not in branch's lineage.
 *
 * @see SPEC §9.2 CHECKOUT-2
 */
export class WorldNotInLineageError extends ManifestoAppError {
  readonly code = "NOT_IN_LINEAGE" as const;

  constructor(
    public readonly worldId: string,
    public readonly branchId: string
  ) {
    super(`World '${worldId}' is not in the lineage of branch '${branchId}'`);
  }
}

// =============================================================================
// Other Errors
// =============================================================================

/**
 * Thrown when attempting to use a reserved namespace.
 *
 * @see SPEC §18 Reserved Namespaces
 */
export class ReservedNamespaceError extends ManifestoAppError {
  readonly code = "RESERVED_NAMESPACE" as const;

  constructor(
    public readonly namespace: string,
    public readonly kind: "action" | "effect"
  ) {
    super(
      `${kind === "action" ? "Action" : "Effect"} type '${namespace}' uses reserved namespace 'system.*'`
    );
  }
}

/**
 * Thrown when mode='require' but defaultActor is not provided.
 *
 * @see SPEC §5.3 ACTOR-1
 */
export class MissingDefaultActorError extends ManifestoAppError {
  readonly code = "MISSING_ACTOR" as const;

  constructor() {
    super(
      "ActorPolicy mode is 'require' but no defaultActor was provided in options"
    );
  }
}

/**
 * Thrown when fork migration fails.
 *
 * @see SPEC §9.5 FORK-3
 */
export class ForkMigrationError extends ManifestoAppError {
  readonly code = "FORK_MIGRATION" as const;

  constructor(
    public readonly fromSchemaHash: string,
    public readonly toSchemaHash: string,
    opts?: { cause?: unknown }
  ) {
    super(
      `Migration from schema '${fromSchemaHash}' to '${toSchemaHash}' failed`,
      opts
    );
  }
}

/**
 * Thrown when MEL domain compilation fails.
 *
 * @see SPEC §5.6 ready()
 */
export class DomainCompileError extends ManifestoAppError {
  readonly code = "DOMAIN_COMPILE" as const;

  constructor(message: string, opts?: { cause?: unknown }) {
    super(`Domain compilation failed: ${message}`, opts);
  }
}

/**
 * Thrown when plugin initialization fails.
 *
 * @see SPEC §15.2
 */
export class PluginInitError extends ManifestoAppError {
  readonly code = "PLUGIN_INIT" as const;

  constructor(
    public readonly pluginIndex: number,
    message: string,
    opts?: { cause?: unknown }
  ) {
    super(`Plugin at index ${pluginIndex} failed to initialize: ${message}`, opts);
  }
}

// =============================================================================
// Liveness Errors
// =============================================================================

/**
 * Thrown when re-injection limit is exceeded during a proposal tick.
 *
 * This error indicates an infinite loop where hooks keep enqueuing
 * actions, potentially causing the system to never terminate.
 *
 * @see FDR-APP-PUB-001 §3 (PUB-LIVENESS-2~3)
 */
export class LivenessError extends ManifestoAppError {
  readonly code = "LIVENESS_VIOLATION" as const;

  constructor(
    public readonly proposalId: string,
    public readonly reinjectionCount: number,
    public readonly limit: number
  ) {
    super(
      `Re-injection limit exceeded for proposal '${proposalId}': ${reinjectionCount} actions enqueued (limit: ${limit}). ` +
      `This may indicate an infinite loop in hook callbacks.`
    );
  }
}
