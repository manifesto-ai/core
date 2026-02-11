/**
 * Hookable Implementation
 *
 * @see SPEC §11 Hook System
 * @module
 */

import type { Hookable, Unsubscribe } from "@manifesto-ai/shared";
import { HookMutationError } from "@manifesto-ai/shared";
import { JobQueue } from "./queue.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

/**
 * Hook execution state for mutation guard.
 */
export interface HookState {
  /** Currently executing hook name */
  currentHook: string | null;
  /** Depth of nested hook calls */
  depth: number;
}

/**
 * Enhanced Hookable implementation with mutation guard.
 *
 * @see SPEC §11.1 Hookable interface
 * @see SPEC §11.4 HOOK-MUT-1~4
 */
export class HookableImpl<TEvents> implements Hookable<TEvents> {
  private _handlers: Map<string, Set<AnyFunction>> = new Map();
  private _hookState: HookState = { currentHook: null, depth: 0 };
  private _jobQueue: JobQueue;

  constructor(jobQueue?: JobQueue) {
    this._jobQueue = jobQueue ?? new JobQueue();
  }

  /**
   * Register a hook handler.
   *
   * @see SPEC §11.1
   */
  on<K extends keyof TEvents>(name: K, fn: TEvents[K]): Unsubscribe {
    const key = name as string;
    if (!this._handlers.has(key)) {
      this._handlers.set(key, new Set());
    }
    const handlers = this._handlers.get(key)!;
    handlers.add(fn as AnyFunction);

    return () => {
      handlers.delete(fn as AnyFunction);
    };
  }

  /**
   * Register a one-time hook handler.
   *
   * @see SPEC §11.1
   */
  once<K extends keyof TEvents>(name: K, fn: TEvents[K]): Unsubscribe {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = ((...args: any[]) => {
      unsub();
      return (fn as AnyFunction)(...args);
    }) as TEvents[K];

    const unsub = this.on(name, wrapper);
    return unsub;
  }

  /**
   * Emit a hook event.
   *
   * @see SPEC §11.4 HOOK-MUT-1~4
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async emit<K extends keyof TEvents>(name: K, ...args: any[]): Promise<void> {
    const key = name as string;
    const handlers = this._handlers.get(key);
    if (!handlers || handlers.size === 0) return;

    // Track hook execution state
    const previousHook = this._hookState.currentHook;
    this._hookState.currentHook = key;
    this._hookState.depth++;

    try {
      for (const handler of handlers) {
        try {
          const result = handler(...args);
          if (result && typeof (result as Promise<unknown>).catch === "function") {
            (result as Promise<unknown>).catch((error) => {
              console.error(`[Hookable] Error in hook '${key}':`, error);
            });
          }
        } catch (error) {
          console.error(`[Hookable] Error in hook '${key}':`, error);
        }
      }
    } finally {
      // Restore previous state
      this._hookState.depth--;
      this._hookState.currentHook = previousHook;

      // Process enqueued jobs after all hooks complete
      if (this._hookState.depth === 0) {
        void this._jobQueue.processAll();
      }
    }
  }

  /**
   * Check if currently inside a hook execution.
   *
   * HOOK-MUT-1: Direct mutations during hook execution are forbidden
   */
  isInHook(): boolean {
    return this._hookState.depth > 0;
  }

  /**
   * Get current hook name (if in hook).
   */
  getCurrentHook(): string | null {
    return this._hookState.currentHook;
  }

  /**
   * Assert that we are NOT in a hook.
   * Throws HookMutationError if we are.
   *
   * HOOK-MUT-2: Mutation attempts during hooks throw HookMutationError
   *
   * @param apiName - Name of the API being called
   * @throws HookMutationError
   */
  assertNotInHook(apiName: string): void {
    if (this.isInHook()) {
      throw new HookMutationError(apiName, this._hookState.currentHook!);
    }
  }

  /**
   * Get the job queue for enqueue operations.
   * @internal
   */
  getJobQueue(): JobQueue {
    return this._jobQueue;
  }

  /**
   * Get count of registered handlers for a hook.
   * @internal
   */
  handlerCount<K extends keyof TEvents>(name: K): number {
    const key = name as string;
    return this._handlers.get(key)?.size ?? 0;
  }
}
