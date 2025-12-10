/**
 * Bridge Types
 *
 * Core interfaces for connecting Manifesto Runtime with external state management systems.
 * Following the Manifesto philosophy of "Non-invasive" integration.
 */

import type {
  SemanticPath,
  DomainRuntime,
  DomainSnapshot,
  ValidationResult,
  ResolvedFieldPolicy,
} from '@manifesto-ai/core';

// =============================================================================
// Adapter Interface - Reading from External State
// =============================================================================

/**
 * Adapter reads data from an external state management system
 * and normalizes it for the Manifesto runtime.
 *
 * Implementations should be side-effect free for getData/getState.
 */
export interface Adapter<TData = unknown, TState = unknown> {
  /**
   * Get data value by semantic path.
   * Path format: "data.fieldName" or "data.nested.field"
   */
  getData(path: SemanticPath): unknown;

  /**
   * Get state value by semantic path.
   * Path format: "state.fieldName" or "state.nested.field"
   */
  getState(path: SemanticPath): unknown;

  /**
   * Get validation status for a path (optional).
   * External systems may track their own validation.
   */
  getValidity?(path: SemanticPath): ValidationResult | undefined;

  /**
   * Subscribe to changes from the external system (optional).
   * For reactive systems that can emit change events.
   * @returns Unsubscribe function
   */
  subscribe?(listener: (changedPaths: SemanticPath[]) => void): () => void;

  /**
   * Capture all data values as a flat record.
   * Used for bulk synchronization.
   */
  captureData(): Record<SemanticPath, unknown>;

  /**
   * Capture all state values as a flat record.
   * Used for bulk synchronization.
   */
  captureState(): Record<SemanticPath, unknown>;
}

// =============================================================================
// Actuator Interface - Writing to External State
// =============================================================================

/**
 * API request structure for apiCall actuator method.
 */
export interface ApiRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  timeout?: number;
}

/**
 * Actuator writes data/state changes to an external system.
 * Each method corresponds to an Effect type in the Manifesto system.
 */
export interface Actuator<TData = unknown, TState = unknown> {
  /**
   * Set a single data value.
   * Called when SetValueEffect targets a data.* path.
   */
  setData(path: SemanticPath, value: unknown): void;

  /**
   * Set a single state value.
   * Called when SetStateEffect targets a state.* path.
   */
  setState(path: SemanticPath, value: unknown): void;

  /**
   * Set multiple data values atomically (optional).
   * For batch updates to improve performance.
   */
  setManyData?(updates: Record<SemanticPath, unknown>): void;

  /**
   * Set multiple state values atomically (optional).
   * For batch updates to improve performance.
   */
  setManyState?(updates: Record<SemanticPath, unknown>): void;

  /**
   * Focus a field (optional).
   * For form libraries that support programmatic focus.
   */
  focus?(path: SemanticPath): void;

  /**
   * Navigate to a route (optional).
   * For router integration.
   */
  navigate?(to: string, mode?: 'push' | 'replace'): void;

  /**
   * Make an API call (optional).
   * For external system integration.
   */
  apiCall?(request: ApiRequest): Promise<unknown>;
}

// =============================================================================
// Command Types - Effect Commands
// =============================================================================

/**
 * Command to set a single value.
 */
export interface SetValueCommand {
  type: 'SET_VALUE';
  path: SemanticPath;
  value: unknown;
  description?: string;
}

/**
 * Command to set multiple values atomically.
 */
export interface SetManyCommand {
  type: 'SET_MANY';
  updates: Record<SemanticPath, unknown>;
  description?: string;
}

/**
 * Command to execute a domain action.
 */
export interface ExecuteActionCommand {
  type: 'EXECUTE_ACTION';
  actionId: string;
  input?: unknown;
  description?: string;
}

/**
 * Union of all command types.
 */
export type Command = SetValueCommand | SetManyCommand | ExecuteActionCommand;

// =============================================================================
// Bridge Error Types
// =============================================================================

/**
 * Error codes for bridge operations.
 */
export type BridgeErrorCode =
  | 'VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'SYNC_ERROR'
  | 'ADAPTER_ERROR'
  | 'DISPOSED_ERROR';

/**
 * Error type for bridge operations.
 */
export interface BridgeError {
  _tag: 'BridgeError';
  code: BridgeErrorCode;
  message: string;
  path?: SemanticPath;
  cause?: Error;
}

// =============================================================================
// Result Type (re-exported for convenience)
// =============================================================================

/**
 * Result type for bridge operations.
 * Re-uses the monadic Result from core.
 */
export type { Result } from '@manifesto-ai/core';

// =============================================================================
// Bridge Interface - Bidirectional Sync
// =============================================================================

/**
 * Listener for snapshot changes.
 */
export type BridgeSnapshotListener<TData = unknown, TState = unknown> = (
  snapshot: DomainSnapshot<TData, TState>,
  changedPaths: SemanticPath[]
) => void;

/**
 * Bridge connects Manifesto Runtime with external state management.
 *
 * It provides bidirectional synchronization:
 * - Pull: External system → Runtime (via Adapter)
 * - Push: Runtime → External system (via Actuator)
 */
export interface Bridge<TData = unknown, TState = unknown> {
  /**
   * Access to the underlying Manifesto runtime.
   */
  readonly runtime: DomainRuntime<TData, TState>;

  /**
   * Capture current external state into runtime.
   * Pulls all data/state from Adapter and updates Runtime.
   */
  capture(): DomainSnapshot<TData, TState>;

  /**
   * Execute a command on the runtime.
   * Returns Result for safe error handling.
   */
  execute(command: Command): Promise<import('@manifesto-ai/core').Result<void, BridgeError>>;

  /**
   * Push runtime state to external system.
   * Writes all changed values via Actuator.
   */
  sync(): void;

  /**
   * Dispose bridge and cleanup subscriptions.
   * After disposal, the bridge cannot be used.
   */
  dispose(): void;

  // === Convenience Methods ===

  /**
   * Get value from runtime by path.
   */
  get(path: SemanticPath): unknown;

  /**
   * Get field policy from runtime.
   */
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;

  /**
   * Check if an action is available (all preconditions satisfied).
   */
  isActionAvailable(actionId: string): boolean;

  /**
   * Subscribe to runtime snapshot changes.
   * @returns Unsubscribe function
   */
  subscribe(listener: BridgeSnapshotListener<TData, TState>): () => void;
}

// =============================================================================
// Bridge Configuration
// =============================================================================

/**
 * Sync mode for bridge operation.
 * - 'push': Runtime → External (Actuator only)
 * - 'pull': External → Runtime (Adapter only)
 * - 'bidirectional': Both directions (default)
 */
export type SyncMode = 'push' | 'pull' | 'bidirectional';

/**
 * Configuration for creating a Bridge.
 */
export interface BridgeConfig<TData = unknown, TState = unknown> {
  /**
   * Manifesto domain runtime to bridge.
   */
  runtime: DomainRuntime<TData, TState>;

  /**
   * Adapter for reading from external state.
   */
  adapter: Adapter<TData, TState>;

  /**
   * Actuator for writing to external state.
   */
  actuator: Actuator<TData, TState>;

  /**
   * Sync mode: 'push', 'pull', or 'bidirectional' (default).
   */
  syncMode?: SyncMode;

  /**
   * Auto-sync on runtime changes (default: true).
   * When true, changes to runtime are automatically pushed to external system.
   */
  autoSync?: boolean;

  /**
   * Debounce sync in milliseconds (default: 0).
   * Useful for reducing sync frequency during rapid changes.
   */
  debounceMs?: number;
}

// =============================================================================
// Type Guards & Utilities
// =============================================================================

/**
 * Check if a command is a SetValueCommand.
 */
export function isSetValueCommand(cmd: Command): cmd is SetValueCommand {
  return cmd.type === 'SET_VALUE';
}

/**
 * Check if a command is a SetManyCommand.
 */
export function isSetManyCommand(cmd: Command): cmd is SetManyCommand {
  return cmd.type === 'SET_MANY';
}

/**
 * Check if a command is an ExecuteActionCommand.
 */
export function isExecuteActionCommand(cmd: Command): cmd is ExecuteActionCommand {
  return cmd.type === 'EXECUTE_ACTION';
}

/**
 * Create a SetValueCommand.
 */
export function setValue(
  path: SemanticPath,
  value: unknown,
  description?: string
): SetValueCommand {
  return { type: 'SET_VALUE', path, value, description };
}

/**
 * Create a SetManyCommand.
 */
export function setMany(
  updates: Record<SemanticPath, unknown>,
  description?: string
): SetManyCommand {
  return { type: 'SET_MANY', updates, description };
}

/**
 * Create an ExecuteActionCommand.
 */
export function executeAction(
  actionId: string,
  input?: unknown,
  description?: string
): ExecuteActionCommand {
  return { type: 'EXECUTE_ACTION', actionId, input, description };
}

/**
 * Create a BridgeError.
 */
export function bridgeError(
  code: BridgeErrorCode,
  message: string,
  options?: { path?: SemanticPath; cause?: Error }
): BridgeError {
  return {
    _tag: 'BridgeError',
    code,
    message,
    path: options?.path,
    cause: options?.cause,
  };
}
