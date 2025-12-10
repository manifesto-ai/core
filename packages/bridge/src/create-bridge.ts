/**
 * Bridge Factory
 *
 * Creates a Bridge that connects Manifesto Runtime with external state management.
 */

import type {
  SemanticPath,
  DomainSnapshot,
  ResolvedFieldPolicy,
  Result,
} from '@manifesto-ai/core';
import { ok, err } from '@manifesto-ai/core';
import type {
  Bridge,
  BridgeConfig,
  BridgeError,
  BridgeSnapshotListener,
  Command,
} from './types.js';
import { bridgeError } from './types.js';

/**
 * Create a Bridge that connects Manifesto Runtime with external state management.
 *
 * @example
 * ```typescript
 * const bridge = createBridge({
 *   runtime: myRuntime,
 *   adapter: myAdapter,
 *   actuator: myActuator,
 *   syncMode: 'bidirectional',
 *   autoSync: true,
 * });
 *
 * // Execute commands
 * await bridge.execute({ type: 'SET_VALUE', path: 'data.name', value: 'John' });
 *
 * // Get values
 * const name = bridge.get('data.name');
 *
 * // Cleanup
 * bridge.dispose();
 * ```
 */
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

  // Internal state
  let isDisposed = false;
  let syncTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPaths = new Set<SemanticPath>();

  // Listeners
  const listeners = new Set<BridgeSnapshotListener<TData, TState>>();

  // Unsubscribe functions
  let adapterUnsubscribe: (() => void) | undefined;
  let runtimeUnsubscribe: (() => void) | undefined;

  // ==========================================================================
  // Setup Subscriptions
  // ==========================================================================

  // Subscribe to adapter changes (pull mode)
  if ((syncMode === 'pull' || syncMode === 'bidirectional') && adapter.subscribe) {
    adapterUnsubscribe = adapter.subscribe((changedPaths) => {
      if (isDisposed) return;

      // Pull changes from external to runtime
      for (const path of changedPaths) {
        const value = path.startsWith('state.')
          ? adapter.getState(path)
          : adapter.getData(path);

        // Set in runtime (ignore validation errors for now)
        runtime.set(path, value);
      }
    });
  }

  // Subscribe to runtime changes (push mode)
  if (syncMode === 'push' || syncMode === 'bidirectional') {
    runtimeUnsubscribe = runtime.subscribe((snapshot, changedPaths) => {
      if (isDisposed) return;

      // Auto-sync to external system
      if (autoSync) {
        schedulePush(changedPaths);
      }

      // Notify bridge listeners
      for (const listener of listeners) {
        try {
          listener(snapshot, changedPaths);
        } catch (e) {
          console.error('Bridge listener error:', e);
        }
      }
    });
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  /**
   * Schedule a push to external system (with optional debounce).
   */
  function schedulePush(paths: SemanticPath[]): void {
    // Add to pending paths
    for (const path of paths) {
      pendingPaths.add(path);
    }

    if (debounceMs > 0) {
      // Debounced push
      if (syncTimeoutId !== null) {
        clearTimeout(syncTimeoutId);
      }
      syncTimeoutId = setTimeout(() => {
        flushPush();
      }, debounceMs);
    } else {
      // Immediate push
      flushPush();
    }
  }

  /**
   * Flush pending paths to external system.
   */
  function flushPush(): void {
    if (isDisposed) return;

    const pathsToSync = Array.from(pendingPaths);
    pendingPaths.clear();
    syncTimeoutId = null;

    pushToExternal(pathsToSync);
  }

  /**
   * Push values to external system via actuator.
   */
  function pushToExternal(paths: SemanticPath[]): void {
    // Separate data and state paths
    const dataPaths: SemanticPath[] = [];
    const statePaths: SemanticPath[] = [];

    for (const path of paths) {
      if (path.startsWith('state.')) {
        statePaths.push(path);
      } else if (path.startsWith('data.')) {
        dataPaths.push(path);
      }
      // Skip derived paths - they are computed, not stored externally
    }

    // Use batch methods if available
    if (dataPaths.length > 0) {
      if (actuator.setManyData) {
        const updates: Record<SemanticPath, unknown> = {};
        for (const path of dataPaths) {
          updates[path] = runtime.get(path);
        }
        actuator.setManyData(updates);
      } else {
        for (const path of dataPaths) {
          actuator.setData(path, runtime.get(path));
        }
      }
    }

    if (statePaths.length > 0) {
      if (actuator.setManyState) {
        const updates: Record<SemanticPath, unknown> = {};
        for (const path of statePaths) {
          updates[path] = runtime.get(path);
        }
        actuator.setManyState(updates);
      } else {
        for (const path of statePaths) {
          actuator.setState(path, runtime.get(path));
        }
      }
    }
  }

  /**
   * Assert bridge is not disposed.
   */
  function assertNotDisposed(): void {
    if (isDisposed) {
      throw new Error('Bridge is disposed');
    }
  }

  // ==========================================================================
  // Bridge Implementation
  // ==========================================================================

  const bridge: Bridge<TData, TState> = {
    get runtime() {
      return runtime;
    },

    capture(): DomainSnapshot<TData, TState> {
      assertNotDisposed();

      // Pull all data from adapter
      const dataRecords = adapter.captureData();
      const stateRecords = adapter.captureState();

      // Set in runtime (batch)
      const allUpdates = { ...dataRecords, ...stateRecords };
      const result = runtime.setMany(allUpdates);

      if (!result.ok) {
        console.warn('Capture had validation errors:', result.error);
      }

      return runtime.getSnapshot();
    },

    async execute(command: Command): Promise<Result<void, BridgeError>> {
      if (isDisposed) {
        return err(bridgeError('DISPOSED_ERROR', 'Bridge is disposed'));
      }

      try {
        switch (command.type) {
          case 'SET_VALUE': {
            const result = runtime.set(command.path, command.value);
            if (!result.ok) {
              return err(
                bridgeError('VALIDATION_ERROR', result.error.message, {
                  path: command.path,
                })
              );
            }
            return ok(undefined);
          }

          case 'SET_MANY': {
            const result = runtime.setMany(command.updates);
            if (!result.ok) {
              return err(
                bridgeError('VALIDATION_ERROR', result.error.message, {
                  path: result.error.path,
                })
              );
            }
            return ok(undefined);
          }

          case 'EXECUTE_ACTION': {
            const result = await runtime.execute(command.actionId, command.input);
            if (!result.ok) {
              return err(
                bridgeError('EXECUTION_ERROR', result.error.cause.message, {
                  cause: result.error.cause,
                })
              );
            }
            return ok(undefined);
          }

          default: {
            const exhaustiveCheck: never = command;
            return err(
              bridgeError(
                'EXECUTION_ERROR',
                `Unknown command type: ${(exhaustiveCheck as Command).type}`
              )
            );
          }
        }
      } catch (e) {
        return err(
          bridgeError('EXECUTION_ERROR', e instanceof Error ? e.message : String(e), {
            cause: e instanceof Error ? e : undefined,
          })
        );
      }
    },

    sync(): void {
      assertNotDisposed();

      // Force flush pending paths
      if (syncTimeoutId !== null) {
        clearTimeout(syncTimeoutId);
        syncTimeoutId = null;
      }

      // Get current snapshot
      const snapshot = runtime.getSnapshot();

      // Collect all paths
      const allPaths: SemanticPath[] = [];

      // Data paths
      if (snapshot.data && typeof snapshot.data === 'object') {
        for (const key of Object.keys(snapshot.data as Record<string, unknown>)) {
          allPaths.push(`data.${key}`);
        }
      }

      // State paths
      if (snapshot.state && typeof snapshot.state === 'object') {
        for (const key of Object.keys(snapshot.state as Record<string, unknown>)) {
          allPaths.push(`state.${key}`);
        }
      }

      // Push to external
      pushToExternal(allPaths);
    },

    dispose(): void {
      if (isDisposed) return;

      isDisposed = true;

      // Cancel pending sync
      if (syncTimeoutId !== null) {
        clearTimeout(syncTimeoutId);
        syncTimeoutId = null;
      }

      // Unsubscribe from adapter
      adapterUnsubscribe?.();
      adapterUnsubscribe = undefined;

      // Unsubscribe from runtime
      runtimeUnsubscribe?.();
      runtimeUnsubscribe = undefined;

      // Clear listeners
      listeners.clear();
      pendingPaths.clear();
    },

    get(path: SemanticPath): unknown {
      assertNotDisposed();
      return runtime.get(path);
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
  };

  return bridge;
}
