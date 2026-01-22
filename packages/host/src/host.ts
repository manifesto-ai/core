/**
 * ManifestoHost v2.0.2
 *
 * Event-loop execution model with Mailbox + Runner + Job architecture.
 *
 * Changes from v2.0.1:
 * - Intent slots stored in data.$host (HOST-NS-1)
 * - Host no longer writes to system.* (INV-SNAP-4)
 *
 * @see host-SPEC-v2.0.2.md
 */

import {
  createCore,
  createSnapshot,
  evaluateComputed,
  isOk,
  type ManifestoCore,
  type DomainSchema,
  type Snapshot,
  type Intent,
  type TraceGraph,
  type Patch,
} from "@manifesto-ai/core";
import { EffectHandlerRegistry, createEffectRegistry } from "./effects/registry.js";
import { EffectExecutor, createEffectExecutor } from "./effects/executor.js";
import type { EffectHandler, EffectHandlerOptions } from "./effects/types.js";
import { createHostError, HostError } from "./errors.js";
import { MailboxManager, type ExecutionMailbox } from "./mailbox.js";
import { processMailbox, createRunnerState, type RunnerState } from "./runner.js";
import { createExecutionContext, ExecutionContextImpl } from "./execution-context.js";
import {
  createHostContextProvider,
  type HostContextProvider,
} from "./context-provider.js";
import type { ExecutionKey, Runtime } from "./types/execution.js";
import type { TraceEvent } from "./types/trace.js";
import { createStartIntentJob, createFulfillEffectJob } from "./types/job.js";
import { defaultRuntime } from "./types/execution.js";
import { getHostState } from "./types/host-state.js";

/**
 * Host result returned from dispatch
 */
export interface HostResult {
  /**
   * Final status
   */
  status: "complete" | "pending" | "error";

  /**
   * Final snapshot
   */
  snapshot: Snapshot;

  /**
   * Combined trace from all iterations
   */
  traces: TraceGraph[];

  /**
   * Error if status is "error"
   */
  error?: HostError;
}

/**
 * Host configuration options
 */
export interface HostOptions {
  /**
   * Maximum iterations for dispatch (default: 100)
   */
  maxIterations?: number;

  /**
   * Initial snapshot data
   */
  initialData?: unknown;

  /**
   * Runtime for timing and scheduling (default: defaultRuntime)
   */
  runtime?: Runtime;

  /**
   * Environment variables to include in context
   */
  env?: Record<string, unknown>;

  /**
   * Trace event handler for debugging
   */
  onTrace?: (event: TraceEvent) => void;

  /**
   * Disable automatic effect execution (for HCTS testing).
   * When true, effects are requested but not auto-executed.
   * Use injectEffectResult() to fulfill effects manually.
   */
  disableAutoEffect?: boolean;
}

const DEFAULT_MAX_ITERATIONS = 100;

type PendingEffect = {
  intentId: string;
  requirementId: string;
  intent: Intent;
  promise: Promise<void>;
};

/**
 * ManifestoHost class v2.0.2
 *
 * Implements the event-loop execution model with:
 * - Mailbox per ExecutionKey (MAIL-1~4)
 * - Single-runner with lost-wakeup prevention (RUN-1~4, LIVE-1~4)
 * - Run-to-completion job model (JOB-1~5)
 * - Frozen context per job (CTX-1~5)
 * - Intent slots in data.$host (HOST-NS-1)
 */
export class ManifestoHost {
  private core: ManifestoCore;
  private schema: DomainSchema;
  private registry: EffectHandlerRegistry;
  private executor: EffectExecutor;
  private maxIterations: number;

  // v2.0.1 architecture components
  private runtime: Runtime;
  private contextProvider: HostContextProvider;
  private mailboxManager: MailboxManager;
  private runnerState: RunnerState;
  private executionContexts: Map<ExecutionKey, ExecutionContextImpl>;
  private onTrace?: (event: TraceEvent) => void;

  // Effect execution tracking
  private pendingEffects: Map<ExecutionKey, PendingEffect>;
  private fatalErrors: Map<ExecutionKey, HostError>;
  private disableAutoEffect: boolean;

  // Current snapshot (managed in memory, caller is responsible for persistence)
  private currentSnapshot: Snapshot | null = null;

  private cloneSnapshot(snapshot: Snapshot): Snapshot {
    return structuredClone(snapshot);
  }

  constructor(schema: DomainSchema, options: HostOptions = {}) {
    this.core = createCore();
    this.schema = schema;
    this.registry = createEffectRegistry();
    this.executor = createEffectExecutor(this.registry);
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.runtime = options.runtime ?? defaultRuntime;
    this.onTrace = options.onTrace;
    this.disableAutoEffect = options.disableAutoEffect ?? false;

    // Initialize v2.0.1 components
    this.contextProvider = createHostContextProvider(this.runtime, {
      env: options.env,
    });
    this.mailboxManager = new MailboxManager();
    this.runnerState = createRunnerState();
    this.executionContexts = new Map();
    this.pendingEffects = new Map();
    this.fatalErrors = new Map();

    // Initialize with initial data if provided
    if (options.initialData !== undefined) {
      this.initializeSnapshot(options.initialData);
    }
  }

  /**
   * Initialize snapshot with data
   */
  private initializeSnapshot(initialData: unknown): void {
    const initialContext = this.contextProvider.createInitialContext();
    const snapshot = createSnapshot(initialData, this.schema.hash, initialContext);
    // Evaluate computed values on initial snapshot
    const computedResult = evaluateComputed(this.schema, snapshot);
    this.currentSnapshot = {
      ...snapshot,
      computed: isOk(computedResult) ? computedResult.value : {},
    };
  }

  /**
   * Register an effect handler
   */
  registerEffect(
    type: string,
    handler: EffectHandler,
    options?: EffectHandlerOptions
  ): void {
    this.registry.register(type, handler, options);
  }

  /**
   * Unregister an effect handler
   */
  unregisterEffect(type: string): boolean {
    return this.registry.unregister(type);
  }

  /**
   * Check if an effect handler is registered
   */
  hasEffect(type: string): boolean {
    return this.registry.has(type);
  }

  /**
   * Get all registered effect types
   */
  getEffectTypes(): string[] {
    return this.registry.getTypes();
  }

  /**
   * Dispatch an intent using v2.0.1 Mailbox + Runner + Job model
   *
   * @param intent - Intent to dispatch
   * @returns Host result with final snapshot and traces
   */
  async dispatch(intent: Intent): Promise<HostResult> {
    if (!this.currentSnapshot) {
      const initialContext = this.contextProvider.createInitialContext();
      return {
        status: "error",
        snapshot: createSnapshot({}, this.schema.hash, initialContext),
        traces: [],
        error: createHostError(
          "HOST_NOT_INITIALIZED",
          "No snapshot available. Initialize the host with initial data."
        ),
      };
    }

    if (!intent.intentId) {
      return {
        status: "error",
        snapshot: this.currentSnapshot,
        traces: [],
        error: createHostError(
          "INVALID_STATE",
          "Intent must have intentId",
          { intent }
        ),
      };
    }

    // Use intentId as execution key
    const key: ExecutionKey = intent.intentId;

    // Create mailbox and execution context
    const mailbox = this.mailboxManager.getOrCreate(key);
    const ctx = this.createExecutionContext(key, mailbox, this.currentSnapshot, intent.intentId);
    this.executionContexts.set(key, ctx);

    // Enqueue StartIntent job
    const job = createStartIntentJob(intent);
    mailbox.enqueue(job);

    // Process mailbox until completion
    let iterations = 0;
    const traces: TraceGraph[] = [];

    let fatalError: HostError | undefined;

    while (iterations < this.maxIterations) {
      iterations++;

      // Run one processing cycle
      await processMailbox(ctx, this.runnerState);

      if (this.fatalErrors.has(key)) {
        fatalError = this.fatalErrors.get(key);
        break;
      }

      // Check if there are pending effects to execute
      if (this.hasPendingEffects(key)) {
        await this.executePendingEffects(key);
        continue;
      }

      // If mailbox is empty and no pending effects, we're done
      if (mailbox.isEmpty()) {
        break;
      }
    }

    // Get final snapshot
    const finalSnapshot = ctx.getSnapshot();
    this.currentSnapshot = finalSnapshot;

    // Determine status
    if (fatalError) {
      // Cleanup
      this.executionContexts.delete(key);
      this.mailboxManager.delete(key);
      this.fatalErrors.delete(key);

      return {
        status: "error",
        snapshot: finalSnapshot,
        traces,
        error: fatalError,
      };
    }

    if (iterations >= this.maxIterations) {
      // Cleanup
      this.executionContexts.delete(key);
      this.mailboxManager.delete(key);
      this.fatalErrors.delete(key);

      return {
        status: "error",
        snapshot: finalSnapshot,
        traces,
        error: createHostError(
          "LOOP_MAX_ITERATIONS",
          `Host loop exceeded maximum iterations (${this.maxIterations})`,
          { maxIterations: this.maxIterations }
        ),
      };
    }

    if (finalSnapshot.system.status === "error") {
      // Cleanup
      this.executionContexts.delete(key);
      this.mailboxManager.delete(key);
      this.fatalErrors.delete(key);

      return {
        status: "error",
        snapshot: finalSnapshot,
        traces,
        error: createHostError(
          "EFFECT_EXECUTION_FAILED",
          finalSnapshot.system.lastError?.message ?? "Unknown error",
          { lastError: finalSnapshot.system.lastError }
        ),
      };
    }

    // Cleanup
    this.executionContexts.delete(key);
    this.mailboxManager.delete(key);
    this.fatalErrors.delete(key);

    const status = finalSnapshot.system.status === "pending" ? "pending" : "complete";

    return {
      status,
      snapshot: finalSnapshot,
      traces,
    };
  }

  /**
   * Create an execution context for a key
   */
  private createExecutionContext(
    key: ExecutionKey,
    mailbox: ExecutionMailbox,
    snapshot: Snapshot,
    intentId: string
  ): ExecutionContextImpl {
    return createExecutionContext({
      key,
      schema: this.schema,
      core: this.core,
      mailbox,
      runtime: this.runtime,
      initialSnapshot: snapshot,
      contextProvider: this.contextProvider,
      currentIntentId: intentId,
      onTrace: (event) => {
        this.onTrace?.(event);
      },
      onEffectRequest: (key, intentId, requirementId, effectType, params, intent) => {
        this.requestEffect(key, intentId, requirementId, effectType, params, intent);
      },
      onFatalError: (key, intentId, error) => {
        this.handleFatalError(key, intentId, error);
      },
    });
  }

  /**
   * Request effect execution (stores for later execution)
   */
  private requestEffect(
    key: ExecutionKey,
    intentId: string,
    requirementId: string,
    effectType: string,
    params: unknown,
    intent: Intent
  ): void {
    // When disableAutoEffect is true, don't auto-execute
    // Effects will be fulfilled via injectEffectResult()
    if (this.disableAutoEffect) {
      return;
    }

    if (this.pendingEffects.has(key)) {
      return;
    }

    // Store effect request and start execution
    const promise = this.executeEffect(key, intentId, requirementId, effectType, params, intent)
      .finally(() => {
        this.pendingEffects.delete(key);
      });
    this.pendingEffects.set(key, { intentId, requirementId, intent, promise });
  }

  /**
   * Execute a single effect and inject result
   */
  private async executeEffect(
    key: ExecutionKey,
    intentId: string,
    requirementId: string,
    _effectType: string,
    _params: unknown,
    intent: Intent
  ): Promise<void> {
    const ctx = this.executionContexts.get(key);
    if (!ctx) return;

    const snapshot = ctx.getSnapshot();
    const requirement = snapshot.system.pendingRequirements.find(
      (r) => r.id === requirementId
    );
    if (!requirement) return;

    // Execute effect
    const result = await this.executor.execute(requirement, snapshot);
    const effectError = result.success
      ? undefined
      : {
          code: result.errorCode ?? "EFFECT_EXECUTION_FAILED",
          message: result.error ?? "Unknown effect execution error",
        };

    // Inject result as FulfillEffect job (REINJ-1~4)
    const mailbox = this.mailboxManager.get(key);
    if (mailbox) {
      const fulfillJob = createFulfillEffectJob(
        intentId,
        requirementId,
        result.patches,
        intent,
        effectError
      );
      mailbox.enqueue(fulfillJob);
    }
  }

  /**
   * Check if there are pending effects for a key
   */
  private hasPendingEffects(key: ExecutionKey): boolean {
    return this.pendingEffects.has(key);
  }

  /**
   * Execute all pending effects for a key
   */
  private async executePendingEffects(key: ExecutionKey): Promise<void> {
    const entry = this.pendingEffects.get(key);
    if (entry) {
      await entry.promise;
    }
  }

  /**
   * Handle fatal error
   */
  private handleFatalError(
    key: ExecutionKey,
    intentId: string,
    error: Error
  ): void {
    // Clear pending effect tracking
    this.pendingEffects.delete(key);

    const hostError = createHostError(
      "INVALID_STATE",
      error.message,
      { intentId }
    );
    this.fatalErrors.set(key, hostError);

    // Mark execution as failed (best-effort) in data.$host
    const ctx = this.executionContexts.get(key);
    if (ctx) {
      try {
        const snapshot = ctx.getSnapshot();
        const hostState = getHostState(snapshot.data);
        const existingErrors = hostState?.errors ?? [];
        const frozenContext = ctx.getFrozenContext();
        const errorValue = {
          code: "FATAL_ERROR",
          message: error.message,
          source: { actionId: intentId, nodePath: "host.fatal" },
          timestamp: frozenContext.now,
        };
        const patches: Patch[] = [
          {
            op: "merge",
            path: "$host",
            value: { lastError: errorValue, errors: [...existingErrors, errorValue] },
          },
        ];
        ctx.applyPatches(patches, "fatal-error");
      } catch {
        // Best-effort only
      }
    }

    // Clear mailbox queue for this key
    const mailbox = this.mailboxManager.get(key);
    if (mailbox) {
      while (!mailbox.isEmpty()) {
        mailbox.dequeue();
      }
    }
  }

  /**
   * Get the current snapshot
   */
  getSnapshot(): Snapshot | null {
    if (!this.currentSnapshot) {
      return null;
    }
    return this.cloneSnapshot(this.currentSnapshot);
  }

  /**
   * Get the domain schema
   */
  getSchema(): DomainSchema {
    return this.schema;
  }

  /**
   * Get the underlying core instance
   */
  getCore(): ManifestoCore {
    return this.core;
  }

  /**
   * Validate the schema
   */
  validateSchema(): ReturnType<ManifestoCore["validate"]> {
    return this.core.validate(this.schema);
  }

  /**
   * Reset the host to initial state
   */
  reset(initialData: unknown): void {
    this.initializeSnapshot(initialData);
  }

  // === v2.0.1 API for HCTS testing ===

  /**
   * Get or create a mailbox for an execution key
   */
  getMailbox(key: ExecutionKey): ExecutionMailbox {
    return this.mailboxManager.getOrCreate(key);
  }

  /**
   * Seed a snapshot for an execution key
   */
  seedSnapshot(key: ExecutionKey, snapshot: Snapshot): void {
    const mailbox = this.mailboxManager.getOrCreate(key);
    const ctx = this.createExecutionContext(key, mailbox, snapshot, "");
    this.executionContexts.set(key, ctx);
  }

  /**
   * Submit an intent for an execution key
   */
  submitIntent(key: ExecutionKey, intent: Intent): void {
    const ctx = this.executionContexts.get(key);
    if (!ctx) {
      throw new Error(`No execution context for key: ${key}`);
    }

    ctx.setCurrentIntentId(intent.intentId!);

    // Enqueue StartIntent job (LIVE-2)
    const mailbox = this.mailboxManager.get(key);
    if (mailbox) {
      const wasEmpty = mailbox.isEmpty();
      const job = createStartIntentJob(intent);
      mailbox.enqueue(job);

      // LIVE-2: When queue transitions from empty to non-empty, emit kick trace
      // The actual processing happens when drain() is called
      if (wasEmpty) {
        this.onTrace?.({
          t: "runner:kick",
          key,
          timestamp: this.runtime.now(),
        } as TraceEvent);
      }
    }
  }

  /**
   * Inject effect result for an execution key
   */
  injectEffectResult(
    key: ExecutionKey,
    requirementId: string,
    intentId: string,
    patches: Patch[],
    intent?: Intent
  ): void {
    const mailbox = this.mailboxManager.get(key);
    if (mailbox) {
      // Try to get intent from data.$host if not provided (v2.0.2 HOST-NS-1)
      const ctx = this.executionContexts.get(key);
      let effectIntent = intent;
      if (!effectIntent && ctx) {
        const intentSlot = ctx.getIntentSlot(intentId);
        if (intentSlot) {
          effectIntent = {
            type: intentSlot.type,
            intentId,
            input: intentSlot.input,
          };
        }
      }

      const job = createFulfillEffectJob(intentId, requirementId, patches, effectIntent);
      mailbox.enqueue(job);
    }
  }

  /**
   * Drain the mailbox for an execution key
   */
  async drain(key: ExecutionKey): Promise<void> {
    const ctx = this.executionContexts.get(key);
    if (!ctx) {
      throw new Error(`No execution context for key: ${key}`);
    }

    await processMailbox(ctx, this.runnerState);
  }

  /**
   * Get trace events for an execution key (for testing)
   */
  getTrace(_key: ExecutionKey): TraceEvent[] {
    // Traces are emitted via onTrace callback
    // This method is for compatibility
    return [];
  }

  /**
   * Get execution context snapshot
   */
  getContextSnapshot(key: ExecutionKey): Snapshot | undefined {
    const ctx = this.executionContexts.get(key);
    const snapshot = ctx?.getSnapshot();
    if (!snapshot) {
      return undefined;
    }
    return this.cloneSnapshot(snapshot);
  }
}

/**
 * Create a new ManifestoHost
 */
export function createHost(schema: DomainSchema, options?: HostOptions): ManifestoHost {
  return new ManifestoHost(schema, options);
}
