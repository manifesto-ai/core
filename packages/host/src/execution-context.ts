/**
 * ExecutionContext Implementation for Host v2.0.2
 *
 * Provides the concrete implementation of ExecutionContext for job handlers.
 *
 * Changes from v2.0.1:
 * - Added intent slot storage (HOST-NS-1)
 *
 * @see host-SPEC-v2.0.2.md §10.10 Canonical Head
 */

import type {
  DomainSchema,
  HostContext,
  Intent,
  ManifestoCore,
  Patch,
  Snapshot,
} from "@manifesto-ai/core";
import type {
  ExecutionContext,
  ExecutionContextOptions,
  ExecutionKey,
  Runtime,
} from "./types/execution.js";
import type { TraceEvent } from "./types/trace.js";
import type { ExecutionMailbox } from "./mailbox.js";
import type { HostContextProvider } from "./context-provider.js";
import type { IntentSlot } from "./types/host-state.js";

/**
 * Extended options for ExecutionContextImpl
 */
export interface ExecutionContextImplOptions extends ExecutionContextOptions {
  contextProvider: HostContextProvider;
  currentIntentId?: string;
}

/**
 * Default ExecutionContext implementation
 *
 * @see SPEC §10.10 Canonical Head
 */
export class ExecutionContextImpl implements ExecutionContext {
  readonly key: ExecutionKey;
  readonly schema: DomainSchema;
  readonly core: ManifestoCore;
  readonly mailbox: ExecutionMailbox;
  readonly runtime: Runtime;

  private snapshot: Snapshot;
  private frozenContext: HostContext | null = null;
  private currentIntentId: string | null = null;

  // Host-owned intent slot storage (v2.0.2 HOST-NS-1)
  private intentSlots: Map<string, IntentSlot> = new Map();

  private readonly contextProvider: HostContextProvider;
  private readonly onTrace?: (event: TraceEvent) => void;
  private readonly onEffectRequest?: (
    key: ExecutionKey,
    intentId: string,
    requirementId: string,
    effectType: string,
    params: unknown,
    intent: Intent
  ) => void;
  private readonly onFatalError?: (
    key: ExecutionKey,
    intentId: string,
    error: Error
  ) => void;

  constructor(options: ExecutionContextImplOptions) {
    this.key = options.key;
    this.schema = options.schema;
    this.core = options.core;
    this.mailbox = options.mailbox;
    this.runtime = options.runtime;
    this.snapshot = options.initialSnapshot;
    this.contextProvider = options.contextProvider;
    this.currentIntentId = options.currentIntentId ?? null;
    this.onTrace = options.onTrace;
    this.onEffectRequest = options.onEffectRequest;
    this.onFatalError = options.onFatalError;
  }

  /**
   * Get the canonical head snapshot
   *
   * @see SPEC §10.10 JOB-4
   */
  getSnapshot(): Snapshot {
    return this.snapshot;
  }

  /**
   * Set the canonical head snapshot
   */
  setSnapshot(snapshot: Snapshot): void {
    this.snapshot = snapshot;
  }

  /**
   * Set the current intent ID for context creation
   */
  setCurrentIntentId(intentId: string): void {
    this.currentIntentId = intentId;
    // Reset frozen context so next getFrozenContext creates a new one
    this.frozenContext = null;
  }

  /**
   * Get the current intent ID
   */
  getCurrentIntentId(): string | null {
    return this.currentIntentId;
  }

  /**
   * Store an intent slot (v2.0.2 HOST-NS-1)
   *
   * Intent slots are stored internally in ExecutionContext to avoid
   * writing to Core-owned snapshot fields.
   */
  setIntentSlot(intentId: string, slot: IntentSlot): void {
    this.intentSlots.set(intentId, slot);
  }

  /**
   * Get an intent slot by ID (v2.0.2 HOST-NS-1)
   */
  getIntentSlot(intentId: string): IntentSlot | undefined {
    return this.intentSlots.get(intentId);
  }

  /**
   * Get all intent slots
   */
  getAllIntentSlots(): ReadonlyMap<string, IntentSlot> {
    return this.intentSlots;
  }

  /**
   * Get the frozen HostContext for the current job
   *
   * @see SPEC §11.3 CTX-1~5
   */
  getFrozenContext(): HostContext {
    // CTX-5: Context captured ONCE per job
    if (!this.frozenContext) {
      const intentId = this.currentIntentId ?? "unknown";
      this.frozenContext = this.contextProvider.createFrozenContext(intentId);
    }
    return this.frozenContext;
  }

  /**
   * Reset frozen context (call at job start)
   */
  resetFrozenContext(): void {
    this.frozenContext = null;
  }

  /**
   * Apply patches to the current snapshot
   */
  applyPatches(patches: Patch[], source: string): Snapshot {
    const frozenContext = this.getFrozenContext();
    const newSnapshot = this.core.apply(
      this.schema,
      this.snapshot,
      patches,
      frozenContext
    );
    this.snapshot = newSnapshot;

    // Emit core:apply trace
    this.trace({
      t: "core:apply",
      key: this.key,
      patchCount: patches.length,
      source,
    });

    return newSnapshot;
  }

  /**
   * Emit a trace event
   */
  trace(event: TraceEvent): void {
    this.onTrace?.(event);
  }

  /**
   * Check if requirement is pending
   *
   * @see SPEC §10.7.2 FULFILL-0
   */
  isPendingRequirement(requirementId: string): boolean {
    return this.snapshot.system.pendingRequirements.some(
      (r) => r.id === requirementId
    );
  }

  /**
   * Clear a requirement from pending list
   *
   * @see SPEC §10.7.1 FULFILL-2, REQ-CLEAR-1
   */
  clearRequirement(requirementId: string): void {
    const remaining = this.snapshot.system.pendingRequirements.filter(
      (r) => r.id !== requirementId
    );

    const patches: Patch[] = [
      { op: "set", path: "system.pendingRequirements", value: remaining },
    ];

    // If no more pending requirements, set status to idle
    if (remaining.length === 0) {
      patches.push({ op: "set", path: "system.status", value: "idle" });
    }

    this.applyPatches(patches, "clear-requirement");
  }

  /**
   * Request effect execution
   *
   * @see SPEC §10.9 Effect Runner Location
   */
  requestEffectExecution(
    intentId: string,
    requirementId: string,
    effectType: string,
    params: unknown,
    intent: Intent
  ): void {
    this.onEffectRequest?.(
      this.key,
      intentId,
      requirementId,
      effectType,
      params,
      intent
    );
  }

  /**
   * Escalate to fatal error
   *
   * @see SPEC §13.4.5 Fatal Escalation
   */
  escalateToFatal(intentId: string, error: Error): void {
    this.trace({
      t: "fatal:escalate",
      key: this.key,
      intentId,
      error: error.message,
    });

    this.onFatalError?.(this.key, intentId, error);
  }
}

/**
 * Create an ExecutionContext
 */
export function createExecutionContext(
  options: ExecutionContextImplOptions
): ExecutionContextImpl {
  return new ExecutionContextImpl(options);
}
