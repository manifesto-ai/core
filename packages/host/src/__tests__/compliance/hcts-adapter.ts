/**
 * Host Test Adapter Interface
 *
 * Defines the contract for adapting different Host implementations
 * to the HCTS test suite. This allows testing v1.x and v2.0 hosts
 * with the same compliance tests.
 *
 * @see host-SPEC-compilance-test-suite.md §1.1
 */

import type { Snapshot, Intent, Patch, DomainSchema } from "@manifesto-ai/core";
import type { ExecutionKey, TraceEvent } from "./hcts-types.js";
import type { DeterministicRuntime } from "./hcts-runtime.js";
import type { EffectHandler } from "../../effects/types.js";

/**
 * Test effect runner interface
 */
export interface TestEffectRunner {
  /**
   * Register an effect handler
   */
  register(type: string, handler: EffectHandler): void;

  /**
   * Get a registered handler by type
   */
  getHandler(type: string): EffectHandler | undefined;

  /**
   * Get all registered effect types
   */
  getRegisteredTypes(): string[];

  /**
   * Execute an effect and return patches
   */
  execute(
    requirementId: string,
    type: string,
    params: Record<string, unknown>
  ): Promise<Patch[]>;

  /**
   * Get execution count for a requirement type
   */
  getExecutionCount(type: string): number;

  /**
   * Reset all handlers and counts
   */
  reset(): void;
}

/**
 * Host Test Adapter interface for HCTS
 *
 * Implementations adapt specific Host versions to the test harness.
 * The adapter provides:
 * - Host lifecycle management
 * - Snapshot seeding and retrieval
 * - Intent submission
 * - Effect result injection
 * - Trace event collection
 */
export interface HostTestAdapter {
  /**
   * Create and initialize the Host instance
   */
  create(opts: {
    schema: DomainSchema;
    effectRunner: TestEffectRunner;
    runtime: DeterministicRuntime;
  }): Promise<void>;

  /**
   * Seed initial snapshot for an execution key
   */
  seedSnapshot(key: ExecutionKey, snapshot: Snapshot): void;

  /**
   * Submit an intent for processing
   */
  submitIntent(key: ExecutionKey, intent: Intent): void;

  /**
   * Inject effect result patches directly (for testing fulfillment)
   */
  injectEffectResult(
    key: ExecutionKey,
    requirementId: string,
    patches: Patch[]
  ): void;

  /**
   * Drain the mailbox until idle (run all pending jobs)
   */
  drain(key: ExecutionKey): Promise<void>;

  /**
   * Get current snapshot for an execution key
   */
  getSnapshot(key: ExecutionKey): Snapshot;

  /**
   * Get trace events for an execution key
   */
  getTrace(key: ExecutionKey): TraceEvent[];

  /**
   * Clear trace events for an execution key
   */
  clearTrace(key: ExecutionKey): void;

  /**
   * Dispose of the adapter and release resources
   */
  dispose(): Promise<void>;
}

/**
 * Simple in-memory effect runner for testing
 */
export class SimpleTestEffectRunner implements TestEffectRunner {
  private handlers = new Map<string, EffectHandler>();
  private executionCounts = new Map<string, number>();

  register(type: string, handler: EffectHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Get a registered handler by type
   */
  getHandler(type: string): EffectHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Get all registered effect types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  async execute(
    requirementId: string,
    type: string,
    params: Record<string, unknown>
  ): Promise<Patch[]> {
    const count = this.executionCounts.get(type) ?? 0;
    this.executionCounts.set(type, count + 1);

    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`Unknown effect type: ${type}`);
    }

    // Create minimal context for the handler
    const context = {
      snapshot: {} as Snapshot,
      requirement: {
        id: requirementId,
        type,
        params,
        actionId: "test",
        flowPosition: { nodePath: "test", snapshotVersion: 0 },
        createdAt: Date.now(),
      },
    };

    return handler(type, params, context);
  }

  getExecutionCount(type: string): number {
    return this.executionCounts.get(type) ?? 0;
  }

  reset(): void {
    this.handlers.clear();
    this.executionCounts.clear();
  }
}

/**
 * Create a simple test effect runner
 */
export function createTestEffectRunner(): TestEffectRunner {
  return new SimpleTestEffectRunner();
}

/**
 * Deferred result for injecting effect results at specific times
 */
export interface DeferredEffectResult {
  requirementId: string;
  resolve: (patches: Patch[]) => void;
  reject: (error: Error) => void;
}

/**
 * Controllable effect runner that allows tests to control when effects complete
 */
export class ControllableEffectRunner implements TestEffectRunner {
  private handlers = new Map<string, EffectHandler>();
  private executionCounts = new Map<string, number>();
  private pendingResults = new Map<string, DeferredEffectResult>();

  register(type: string, handler: EffectHandler): void {
    this.handlers.set(type, handler);
  }

  getHandler(type: string): EffectHandler | undefined {
    return this.handlers.get(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  async execute(
    requirementId: string,
    type: string,
    params: Record<string, unknown>
  ): Promise<Patch[]> {
    const count = this.executionCounts.get(type) ?? 0;
    this.executionCounts.set(type, count + 1);

    // If no handler, create a deferred result that tests can resolve
    if (!this.handlers.has(type)) {
      return new Promise((resolve, reject) => {
        this.pendingResults.set(requirementId, {
          requirementId,
          resolve,
          reject,
        });
      });
    }

    const handler = this.handlers.get(type)!;
    const context = {
      snapshot: {} as Snapshot,
      requirement: {
        id: requirementId,
        type,
        params,
        actionId: "test",
        flowPosition: { nodePath: "test", snapshotVersion: 0 },
        createdAt: Date.now(),
      },
    };

    return handler(type, params, context);
  }

  /**
   * Complete a pending effect with success
   */
  completeEffect(requirementId: string, patches: Patch[]): void {
    const deferred = this.pendingResults.get(requirementId);
    if (deferred) {
      this.pendingResults.delete(requirementId);
      deferred.resolve(patches);
    }
  }

  /**
   * Complete a pending effect with failure
   */
  failEffect(requirementId: string, error: Error): void {
    const deferred = this.pendingResults.get(requirementId);
    if (deferred) {
      this.pendingResults.delete(requirementId);
      deferred.reject(error);
    }
  }

  /**
   * Check if an effect is pending
   */
  hasPendingEffect(requirementId: string): boolean {
    return this.pendingResults.has(requirementId);
  }

  /**
   * Get all pending effect IDs
   */
  getPendingEffectIds(): string[] {
    return Array.from(this.pendingResults.keys());
  }

  getExecutionCount(type: string): number {
    return this.executionCounts.get(type) ?? 0;
  }

  reset(): void {
    this.handlers.clear();
    this.executionCounts.clear();
    // Reject any pending effects
    for (const deferred of this.pendingResults.values()) {
      deferred.reject(new Error("Effect runner reset"));
    }
    this.pendingResults.clear();
  }
}

/**
 * Create a controllable effect runner for advanced testing scenarios
 */
export function createControllableEffectRunner(): ControllableEffectRunner {
  return new ControllableEffectRunner();
}
