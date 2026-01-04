import {
  createCore,
  createSnapshot,
  createIntent,
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
import type { SnapshotStore } from "./persistence/interface.js";
import { createMemoryStore } from "./persistence/memory.js";
import { runHostLoop, type HostLoopOptions, type HostLoopResult } from "./loop.js";
import { createHostError, HostError } from "./errors.js";
import {
  processTranslatorOutput,
  createTranslatorIntentId,
  hasAmbiguity,
  type TranslatorOutput,
} from "./translator.js";
import { createInitialHostContext } from "./context.js";

/**
 * Host result returned from dispatch
 */
export interface HostResult {
  /**
   * Final status
   */
  status: "complete" | "halted" | "error";

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
   * Snapshot store (default: MemorySnapshotStore)
   */
  store?: SnapshotStore;

  /**
   * Host loop options
   */
  loop?: HostLoopOptions;

  /**
   * Initial snapshot data (if no snapshot in store)
   */
  initialData?: unknown;
}

/**
 * ManifestoHost class
 *
 * Orchestrates the execution of Manifesto intents with effect handling.
 *
 * Usage:
 * ```typescript
 * const host = createHost(schema);
 * host.registerEffect("http", httpHandler);
 * const result = await host.dispatch(createIntent("myAction", { ... }));
 * ```
 */
export class ManifestoHost {
  private core: ManifestoCore;
  private schema: DomainSchema;
  private registry: EffectHandlerRegistry;
  private executor: EffectExecutor;
  private store: SnapshotStore;
  private loopOptions: HostLoopOptions;
  private initialized: boolean = false;

  constructor(schema: DomainSchema, options: HostOptions = {}) {
    this.core = createCore();
    this.schema = schema;
    this.registry = createEffectRegistry();
    this.executor = createEffectExecutor(this.registry);
    this.store = options.store ?? createMemoryStore();
    this.loopOptions = options.loop ?? {};

    // Initialize with initial data if store is empty
    this.initializeIfNeeded(options.initialData);
  }

  private async initializeIfNeeded(initialData?: unknown): Promise<void> {
    const existing = await this.store.get();
    if (!existing && initialData !== undefined) {
      const snapshot = createSnapshot(initialData, this.schema.hash, createInitialHostContext());
      // Evaluate computed values on initial snapshot
      const computedResult = evaluateComputed(this.schema, snapshot);
      const snapshotWithComputed: Snapshot = {
        ...snapshot,
        computed: isOk(computedResult) ? computedResult.value : {},
      };
      await this.store.save(snapshotWithComputed);
    }
    this.initialized = true;
  }

  /**
   * Register an effect handler
   *
   * @param type - Effect type (e.g., "http", "storage")
   * @param handler - Handler function
   * @param options - Handler options
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
   *
   * @param type - Effect type to unregister
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
   * Dispatch an intent
   *
   * This is the main entry point for processing intents.
   * It runs the host loop until completion, halt, or error.
   *
   * @param intent - Intent to dispatch (use createIntent helper)
   * @param loopOptions - Optional loop options to merge with defaults
   * @returns Host result with final snapshot and traces
   */
  async dispatch(intent: Intent, loopOptions?: Partial<HostLoopOptions>): Promise<HostResult> {
    // Wait for initialization
    if (!this.initialized) {
      await this.initializeIfNeeded();
    }

    // Get current snapshot
    let snapshot = await this.store.get();
    if (!snapshot) {
      return {
        status: "error",
        snapshot: createSnapshot({}, this.schema.hash, createInitialHostContext()),
        traces: [],
        error: createHostError(
          "HOST_NOT_INITIALIZED",
          "No snapshot in store. Initialize the host with initial data."
        ),
      };
    }

    // Merge loop options with defaults
    const mergedOptions: HostLoopOptions = {
      ...this.loopOptions,
      ...loopOptions,
    };

    // Run the host loop
    const result = await runHostLoop(
      this.core,
      this.schema,
      snapshot,
      intent,
      this.executor,
      mergedOptions
    );

    // Save final snapshot
    await this.store.save(result.snapshot);

    return {
      status: result.status,
      snapshot: result.snapshot,
      traces: result.traces,
      error: result.error,
    };
  }

  /**
   * Dispatch with Translator output.
   *
   * Processes Translator output through Compiler lowering and evaluation,
   * applies the concrete patches, then runs the standard Host loop.
   *
   * @param output - Translator output with MEL IR fragments
   * @param options - Optional configuration (intentId, actionName)
   * @returns Host result with final snapshot and traces
   *
   * @see Host SPEC v1.1 §4.3, §13.2
   */
  async dispatchWithTranslator(
    output: TranslatorOutput,
    options?: { intentId?: string; actionName?: string }
  ): Promise<HostResult> {
    // Wait for initialization
    if (!this.initialized) {
      await this.initializeIfNeeded();
    }

    // Check for ambiguity - caller should handle before dispatch
    if (hasAmbiguity(output)) {
      return {
        status: "error",
        snapshot: (await this.store.get()) ?? createSnapshot({}, this.schema.hash, createInitialHostContext()),
        traces: [],
        error: createHostError(
          "TRANSLATOR_AMBIGUOUS",
          "Translator output has ambiguity. Resolve before dispatch.",
          { ambiguity: output.ambiguity }
        ),
      };
    }

    // Get current snapshot
    let snapshot = await this.store.get();
    if (!snapshot) {
      return {
        status: "error",
        snapshot: createSnapshot({}, this.schema.hash, createInitialHostContext()),
        traces: [],
        error: createHostError(
          "HOST_NOT_INITIALIZED",
          "No snapshot in store. Initialize the host with initial data."
        ),
      };
    }

    // FDR-H014: Single intentId throughout
    const intentId = options?.intentId ?? createTranslatorIntentId();

    try {
      // Process translator output (lower + evaluate)
      const result = processTranslatorOutput(output, snapshot, {
        intentId,
        actionName: options?.actionName,
      });

      // Apply concrete patches to snapshot
      // Convert ConcretePatch[] to Patch[] format expected by core.apply()
      if (result.patches.length > 0) {
        const corePatches = result.patches.map((p): Patch => {
          if (p.op === "unset") {
            return { op: "unset", path: p.path };
          } else if (p.op === "merge") {
            return { op: "merge", path: p.path, value: p.value as Record<string, unknown> };
          } else {
            return { op: "set", path: p.path, value: p.value };
          }
        });
        snapshot = this.core.apply(this.schema, snapshot, corePatches, createInitialHostContext());
        await this.store.save(snapshot);
      }

      // Run standard host loop with same intentId
      return this.dispatch(result.intent);
    } catch (error) {
      if (error instanceof HostError) {
        return {
          status: "error",
          snapshot,
          traces: [],
          error,
        };
      }
      throw error;
    }
  }

  /**
   * Get the current snapshot
   */
  async getSnapshot(): Promise<Snapshot | null> {
    // Wait for initialization
    if (!this.initialized) {
      await this.initializeIfNeeded();
    }
    return this.store.get();
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
   * Get the snapshot store
   */
  getStore(): SnapshotStore {
    return this.store;
  }

  /**
   * Validate the schema
   */
  validateSchema(): ReturnType<ManifestoCore["validate"]> {
    return this.core.validate(this.schema);
  }

  /**
   * Reset the host to initial state
   *
   * @param initialData - New initial data
   */
  async reset(initialData: unknown): Promise<void> {
    await this.store.clear();
    const snapshot = createSnapshot(initialData, this.schema.hash, createInitialHostContext());
    // Evaluate computed values on reset snapshot
    const computedResult = evaluateComputed(this.schema, snapshot);
    const snapshotWithComputed: Snapshot = {
      ...snapshot,
      computed: isOk(computedResult) ? computedResult.value : {},
    };
    await this.store.save(snapshotWithComputed);
  }
}

/**
 * Create a new ManifestoHost
 *
 * @param schema - Domain schema
 * @param options - Host options
 */
export function createHost(schema: DomainSchema, options?: HostOptions): ManifestoHost {
  return new ManifestoHost(schema, options);
}
