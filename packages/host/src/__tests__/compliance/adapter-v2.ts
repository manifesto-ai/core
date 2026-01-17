/**
 * V2.0.1 Host Adapter for HCTS
 *
 * Adapts the v2.0.1 ManifestoHost implementation to the
 * HostTestAdapter interface for compliance testing.
 *
 * @see host-SPEC-v2.0.1.md
 */

import type { Snapshot, Intent, Patch, DomainSchema } from "@manifesto-ai/core";
import { createCore, type ManifestoCore } from "@manifesto-ai/core";
import type { ExecutionKey, TraceEvent } from "./hcts-types.js";
import type { DeterministicRuntime } from "./hcts-runtime.js";
import type { HostTestAdapter, TestEffectRunner } from "./hcts-adapter.js";
import { ManifestoHost } from "../../host.js";
import type { EffectHandler } from "../../effects/types.js";

/**
 * V2.0.1 adapter implementation
 *
 * This adapter wraps the ManifestoHost v2.0.1 implementation
 * for HCTS compliance testing.
 */
export class V2HostAdapter implements HostTestAdapter {
  private host: ManifestoHost | null = null;
  private effectRunner: TestEffectRunner | null = null;
  private runtime: DeterministicRuntime | null = null;
  private traces: Map<ExecutionKey, TraceEvent[]> = new Map();
  private submittedIntents: Map<ExecutionKey, Intent> = new Map();

  async create(opts: {
    schema: DomainSchema;
    effectRunner: TestEffectRunner;
    runtime: DeterministicRuntime;
  }): Promise<void> {
    this.effectRunner = opts.effectRunner;
    this.runtime = opts.runtime;

    // Create host with the runtime
    // Use disableAutoEffect for HCTS - we manually execute effects via effectRunner
    this.host = new ManifestoHost(opts.schema, {
      runtime: opts.runtime,
      initialData: {},
      disableAutoEffect: true,
      onTrace: (event) => {
        const traces = this.traces.get(event.key) ?? [];
        traces.push(event);
        this.traces.set(event.key, traces);
      },
    });

    // Note: We don't register effect handlers with the host because
    // disableAutoEffect is true. Instead, we execute effects manually
    // in drain() using the effectRunner.
  }

  seedSnapshot(key: ExecutionKey, snapshot: Snapshot): void {
    if (!this.host) throw new Error("Host not created");
    this.traces.set(key, []);
    this.host.seedSnapshot(key, snapshot);
  }

  submitIntent(key: ExecutionKey, intent: Intent): void {
    if (!this.host) throw new Error("Host not created");

    // Store the intent for later use in drain()
    this.submittedIntents.set(key, intent);

    // Register any new effect handlers that may have been added
    if (this.effectRunner) {
      for (const type of this.effectRunner.getRegisteredTypes()) {
        if (!this.host.hasEffect(type)) {
          const handler = this.effectRunner.getHandler(type);
          if (handler) {
            this.host.registerEffect(type, handler);
          }
        }
      }
    }

    this.host.submitIntent(key, intent);
  }

  injectEffectResult(
    key: ExecutionKey,
    requirementId: string,
    patches: Patch[]
  ): void {
    if (!this.host) throw new Error("Host not created");

    // Get the intentId from the current snapshot
    const snapshot = this.host.getContextSnapshot(key);
    const intentId = snapshot?.system?.currentAction ?? "";

    this.host.injectEffectResult(key, requirementId, intentId, patches);
  }

  async drain(key: ExecutionKey): Promise<void> {
    if (!this.host) throw new Error("Host not created");
    if (!this.runtime) throw new Error("Runtime not created");
    if (!this.effectRunner) throw new Error("Effect runner not created");

    // Keep draining until mailbox is empty and no pending requirements
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      iterations++;

      // Run any pending microtasks from previous iteration
      this.runtime.runAllMicrotasks();

      // Process the mailbox
      await this.host.drain(key);

      // Run microtasks that were scheduled during drain
      this.runtime.runAllMicrotasks();

      // Check for pending requirements that need effect execution
      const snapshot = this.host.getContextSnapshot(key);
      if (snapshot) {
        const pendingReqs = snapshot.system.pendingRequirements;

        // Get the stored intent for this execution
        const intent = this.submittedIntents.get(key);
        const intentId = intent?.intentId ?? "";

        // Execute effects and inject results
        for (const req of pendingReqs) {
          const handler = this.effectRunner.getHandler(req.type);
          let patches: Array<{ op: string; path: string; value?: unknown }> = [];

          if (handler) {
            try {
              patches = await handler(req.type, req.params as Record<string, unknown>, {
                snapshot,
                requirement: req,
              });
            } catch (err) {
              // Effect failed - record error
              const effectError = err instanceof Error ? err : new Error(String(err));
              patches = this.createErrorPatches(effectError.message, "EFFECT_EXECUTION_FAILED", snapshot);
            }
          } else {
            // Unknown effect type - record error
            patches = this.createErrorPatches(`Unknown effect type: ${req.type}`, "UNKNOWN_EFFECT", snapshot);
          }

          // Inject the result with the stored intent
          this.host.injectEffectResult(key, req.id, intentId, patches as any, intent);
        }

        // If we had pending requirements, continue processing
        if (pendingReqs.length > 0) {
          continue;
        }
      }

      // Check if we're done
      const mailbox = this.host.getMailbox(key);
      const hasPendingTasks =
        this.runtime.pendingMicrotaskCount() > 0 ||
        this.runtime.pendingMacrotaskCount() > 0;

      if (mailbox.isEmpty() && !hasPendingTasks) {
        break;
      }
    }
  }

  getSnapshot(key: ExecutionKey): Snapshot {
    if (!this.host) throw new Error("Host not created");
    const snapshot = this.host.getContextSnapshot(key);
    if (!snapshot) {
      throw new Error(`No snapshot for key: ${key}`);
    }
    return snapshot;
  }

  getTrace(key: ExecutionKey): TraceEvent[] {
    return this.traces.get(key) ?? [];
  }

  clearTrace(key: ExecutionKey): void {
    this.traces.set(key, []);
  }

  /**
   * Create error patches for recording effect execution failures
   */
  private createErrorPatches(
    message: string,
    code: string,
    snapshot: Snapshot
  ): Array<{ op: string; path: string; value?: unknown }> {
    const errorValue = {
      code,
      message,
      source: { actionId: "effect", nodePath: "/" },
      timestamp: this.runtime?.now() ?? Date.now(),
    };

    const existingErrors = snapshot.system.errors || [];

    return [
      { op: "set", path: "system.lastError", value: errorValue },
      { op: "set", path: "system.errors", value: [...existingErrors, errorValue] },
    ];
  }

  async dispose(): Promise<void> {
    this.host = null;
    this.effectRunner = null;
    this.runtime = null;
    this.traces.clear();
    this.submittedIntents.clear();
  }
}

/**
 * Create a V2 adapter instance
 */
export function createV2Adapter(): HostTestAdapter {
  return new V2HostAdapter();
}

// For compatibility, also export as the default adapter
export { createV2Adapter as createV1Adapter };
export { V2HostAdapter as V1HostAdapter };
