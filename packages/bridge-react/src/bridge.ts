/**
 * Bridge Types and Factory
 *
 * Defines the Bridge interface and createBridge factory
 * following the @manifesto-ai/bridge pattern.
 */

import type {
  SemanticPath,
  DomainRuntime,
  Result,
  SetError,
  EffectError,
  ResolvedFieldPolicy,
  DomainSnapshot,
} from '@manifesto-ai/core';
import { ok, err, isErr } from '@manifesto-ai/core';
import type { Adapter } from './adapter.js';
import type { Actuator } from './actuator.js';

// ============================================================================
// Command Types
// ============================================================================

export interface SetValueCommand {
  type: 'SET_VALUE';
  path: SemanticPath;
  value: unknown;
}

export interface SetManyCommand {
  type: 'SET_MANY';
  updates: Record<SemanticPath, unknown>;
}

export interface ExecuteActionCommand {
  type: 'EXECUTE_ACTION';
  actionId: string;
  input?: unknown;
}

export type Command = SetValueCommand | SetManyCommand | ExecuteActionCommand;

// ============================================================================
// Bridge Error Types
// ============================================================================

export type BridgeErrorCode =
  | 'VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'SYNC_ERROR'
  | 'ADAPTER_ERROR'
  | 'DISPOSED_ERROR';

export interface BridgeError {
  code: BridgeErrorCode;
  message: string;
  path?: SemanticPath;
  cause?: unknown;
}

// ============================================================================
// Bridge Snapshot
// ============================================================================

export interface BridgeSnapshot<TData = unknown, TState = unknown> {
  data: TData;
  state: TState;
  timestamp: number;
}

export type BridgeSnapshotListener<TData = unknown, TState = unknown> = (
  snapshot: BridgeSnapshot<TData, TState>
) => void;

// ============================================================================
// Bridge Interface
// ============================================================================

export type SyncMode = 'push' | 'pull' | 'bidirectional';

export interface Bridge<TData = unknown, TState = unknown> {
  /** The underlying runtime */
  readonly runtime: DomainRuntime<TData, TState>;

  /** Capture external state into runtime */
  capture(): void;

  /** Execute a command */
  execute(
    command: Command
  ): Result<void, SetError | EffectError> | Promise<Result<void, EffectError>>;

  /** Sync runtime changes to external system */
  sync(): void;

  /** Dispose the bridge and clean up subscriptions */
  dispose(): void;

  /** Get value by path */
  get<T = unknown>(path: SemanticPath): T;

  /** Get field policy */
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;

  /** Check if action is available */
  isActionAvailable(actionId: string): boolean;

  /** Subscribe to snapshot changes */
  subscribe(listener: BridgeSnapshotListener<TData, TState>): () => void;

  /** Get current snapshot */
  getSnapshot(): DomainSnapshot<TData, TState>;
}

// ============================================================================
// Bridge Configuration
// ============================================================================

export interface BridgeConfig<TData = unknown, TState = unknown> {
  /** The domain runtime */
  runtime: DomainRuntime<TData, TState>;
  /** Adapter for reading from external state */
  adapter: Adapter<TData, TState>;
  /** Actuator for writing to external state */
  actuator: Actuator<TData, TState>;
  /** Sync mode */
  syncMode?: SyncMode;
  /** Enable auto-sync on changes */
  autoSync?: boolean;
  /** Debounce delay in ms for push operations */
  debounceMs?: number;
}

// ============================================================================
// Command Factories
// ============================================================================

export function setValue(path: SemanticPath, value: unknown): SetValueCommand {
  return { type: 'SET_VALUE', path, value };
}

export function setMany(
  updates: Record<SemanticPath, unknown>
): SetManyCommand {
  return { type: 'SET_MANY', updates };
}

export function executeAction(
  actionId: string,
  input?: unknown
): ExecuteActionCommand {
  return { type: 'EXECUTE_ACTION', actionId, input };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSetValueCommand(cmd: Command): cmd is SetValueCommand {
  return cmd.type === 'SET_VALUE';
}

export function isSetManyCommand(cmd: Command): cmd is SetManyCommand {
  return cmd.type === 'SET_MANY';
}

export function isExecuteActionCommand(
  cmd: Command
): cmd is ExecuteActionCommand {
  return cmd.type === 'EXECUTE_ACTION';
}

// ============================================================================
// Bridge Factory
// ============================================================================

export function createBridge<TData = unknown, TState = unknown>(
  config: BridgeConfig<TData, TState>
): Bridge<TData, TState> {
  const {
    runtime,
    adapter,
    actuator,
    syncMode = 'bidirectional',
    autoSync = true,
    debounceMs = 0,
  } = config;

  let disposed = false;
  let pushTimeout: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<BridgeSnapshotListener<TData, TState>>();
  const pendingPaths = new Set<SemanticPath>();

  // Subscriptions
  const unsubscribes: Array<() => void> = [];

  function assertNotDisposed(): void {
    if (disposed) {
      throw new Error('Bridge has been disposed');
    }
  }

  function notifyListeners(): void {
    const snapshot = runtime.getSnapshot();
    const bridgeSnapshot: BridgeSnapshot<TData, TState> = {
      data: snapshot.data,
      state: snapshot.state,
      timestamp: Date.now(),
    };
    for (const listener of listeners) {
      listener(bridgeSnapshot);
    }
  }

  function schedulePush(path: SemanticPath): void {
    pendingPaths.add(path);

    if (debounceMs > 0) {
      if (pushTimeout) {
        clearTimeout(pushTimeout);
      }
      pushTimeout = setTimeout(flushPush, debounceMs);
    } else {
      flushPush();
    }
  }

  function flushPush(): void {
    if (pendingPaths.size === 0) return;

    const paths = Array.from(pendingPaths);
    pendingPaths.clear();

    for (const path of paths) {
      const value = runtime.get(path);
      if (path.startsWith('data.')) {
        actuator.setData(path, value);
      } else if (path.startsWith('state.')) {
        actuator.setState(path, value);
      }
    }
  }

  // Set up adapter subscription (pull mode)
  if ((syncMode === 'pull' || syncMode === 'bidirectional') && adapter.subscribe) {
    const unsubAdapter = adapter.subscribe(() => {
      if (autoSync) {
        bridge.capture();
      }
    });
    unsubscribes.push(unsubAdapter);
  }

  // Set up runtime subscription (push mode)
  if (syncMode === 'push' || syncMode === 'bidirectional') {
    const unsubRuntime = runtime.subscribe(() => {
      notifyListeners();
      if (autoSync) {
        // In push mode, sync changes to external system
        // This is a simplified version - real implementation would track changed paths
      }
    });
    unsubscribes.push(unsubRuntime);
  }

  const bridge: Bridge<TData, TState> = {
    runtime,

    capture(): void {
      assertNotDisposed();

      const dataCapture = adapter.captureData();
      const stateCapture = adapter.captureState();

      // Update runtime with captured data
      for (const [path, value] of Object.entries(dataCapture)) {
        runtime.set(path, value);
      }

      for (const [path, value] of Object.entries(stateCapture)) {
        runtime.set(path, value);
      }
    },

    execute(
      command: Command
    ):
      | Result<void, SetError | EffectError>
      | Promise<Result<void, EffectError>> {
      assertNotDisposed();

      if (isSetValueCommand(command)) {
        const result = runtime.set(command.path, command.value);
        if (!isErr(result) && autoSync) {
          schedulePush(command.path);
        }
        return result;
      }

      if (isSetManyCommand(command)) {
        const result = runtime.setMany(command.updates);
        if (!isErr(result) && autoSync) {
          for (const path of Object.keys(command.updates)) {
            schedulePush(path);
          }
        }
        return result;
      }

      if (isExecuteActionCommand(command)) {
        return runtime.execute(command.actionId, command.input);
      }

      return ok(undefined);
    },

    sync(): void {
      assertNotDisposed();
      flushPush();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      if (pushTimeout) {
        clearTimeout(pushTimeout);
      }

      for (const unsub of unsubscribes) {
        unsub();
      }

      listeners.clear();
      pendingPaths.clear();
    },

    get<T = unknown>(path: SemanticPath): T {
      assertNotDisposed();
      return runtime.get<T>(path);
    },

    getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy {
      assertNotDisposed();
      return runtime.getFieldPolicy(path);
    },

    isActionAvailable(actionId: string): boolean {
      assertNotDisposed();
      const preconditions = runtime.getPreconditions(actionId);
      return preconditions.every((p) => p.satisfied);
    },

    subscribe(listener: BridgeSnapshotListener<TData, TState>): () => void {
      assertNotDisposed();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot(): DomainSnapshot<TData, TState> {
      assertNotDisposed();
      return runtime.getSnapshot();
    },
  };

  return bridge;
}

// ============================================================================
// Bridge Error Factory
// ============================================================================

export function bridgeError(
  code: BridgeErrorCode,
  message: string,
  path?: SemanticPath,
  cause?: unknown
): BridgeError {
  return { code, message, path, cause };
}
