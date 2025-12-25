/**
 * @manifesto-ai/bridge-react types
 *
 * React hook return types for Manifesto Domain Runtime integration
 */

import type {
  SemanticPath,
  DomainRuntime,
  ManifestoDomain,
  Result,
  SetError,
  EffectError,
  PreconditionStatus,
  ResolvedFieldPolicy,
} from '@manifesto-ai/core';

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * useValue return type
 */
export type UseValueResult<T> = {
  /** Current value */
  value: T;
  /** Path being watched */
  path: SemanticPath;
};

/**
 * useValues return type
 */
export type UseValuesResult = {
  /** Values by path */
  values: Record<SemanticPath, unknown>;
  /** Paths being watched */
  paths: SemanticPath[];
};

/**
 * useSetValue return type
 */
export type UseSetValueResult = {
  /** Set a value at a path */
  setValue: (path: SemanticPath, value: unknown) => Result<void, SetError>;
  /** Set multiple values */
  setValues: (updates: Record<SemanticPath, unknown>) => Result<void, SetError>;
  /** Last error (if any) */
  error: SetError | null;
  /** Clear the error */
  clearError: () => void;
};

/**
 * useAction return type
 */
export type UseActionResult = {
  /** Execute the action */
  execute: (input?: unknown) => Promise<Result<void, EffectError>>;
  /** Whether the action is currently executing */
  isExecuting: boolean;
  /** Last error (if any) */
  error: EffectError | null;
  /** Clear the error */
  clearError: () => void;
  /** Whether the action is available (preconditions met) */
  isAvailable: boolean;
  /** Precondition statuses */
  preconditions: PreconditionStatus[];
};

/**
 * useFieldPolicy return type
 */
export type UseFieldPolicyResult = ResolvedFieldPolicy;

/**
 * useActionAvailability return type
 */
export type UseActionAvailabilityResult = {
  /** Whether the action is available */
  isAvailable: boolean;
  /** Precondition statuses */
  preconditions: PreconditionStatus[];
  /** Blocked reasons (unsatisfied preconditions) */
  blockedReasons: Array<{
    path: SemanticPath;
    expected: 'true' | 'false';
    actual: boolean;
    reason?: string;
  }>;
};

// ============================================================================
// Context Types (Legacy - for backward compatibility)
// ============================================================================

/**
 * RuntimeContext value type
 * @deprecated Use BridgeContextValue instead
 */
export type RuntimeContextValue<TData = unknown, TState = unknown> = {
  runtime: DomainRuntime<TData, TState>;
};

/**
 * DomainContext value type
 * @deprecated Use BridgeContextValue instead
 */
export type DomainContextValue<TData = unknown, TState = unknown> = {
  domain: ManifestoDomain<TData, TState>;
};

// ============================================================================
// Re-export bridge types for convenience
// ============================================================================

export type {
  Adapter,
  ReactAdapterOptions,
} from './adapter.js';

export type {
  Actuator,
  ReactActuatorOptions,
  ApiRequest,
} from './actuator.js';

export type {
  Bridge,
  BridgeConfig,
  BridgeError,
  BridgeErrorCode,
  BridgeSnapshot,
  BridgeSnapshotListener,
  Command,
  SetValueCommand,
  SetManyCommand,
  ExecuteActionCommand,
  SyncMode,
} from './bridge.js';

export type {
  BridgeContextValue,
  BridgeProviderProps,
} from './provider.js';

export type {
  UseManifestoBridgeOptions,
} from './use-bridge.js';
