import {
  createCore,
  createSnapshot,
  createIntent,
  type ManifestoCore,
  type DomainSchema,
  type Snapshot,
  type Intent,
  type TraceGraph,
  type HostContext,
} from "@manifesto-ai/core";
import { EffectHandlerRegistry, createEffectRegistry } from "./effects/registry.js";
import { EffectExecutor, createEffectExecutor } from "./effects/executor.js";
import type { EffectHandler, EffectHandlerOptions } from "./effects/types.js";
import type { SnapshotStore } from "./persistence/interface.js";
import { createMemoryStore } from "./persistence/memory.js";
import { runHostLoop, type HostLoopOptions, type HostLoopResult } from "./loop.js";
import { createHostError, HostError } from "./errors.js";
import { createInitialHostContext, type HostContextOptions } from "./context.js";

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
   * Initial snapshot (preferred over initialData)
   */
  snapshot?: Snapshot;

  /**
   * Initial snapshot data (if no snapshot in store)
   */
  initialData?: unknown;

  /**
   * Host context for initial snapshot creation
   */
  initialContext?: HostContext;

  /**
   * Host context providers (merged into loop options)
   */
  context?: HostContextOptions;
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
 * const intent = createIntent("myAction", { ... }, "intent-1");
 * const result = await host.dispatch(intent);
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
    this.loopOptions = {
      ...options.loop,
      context: {
        ...options.context,
        ...options.loop?.context,
      },
    };

    // Initialize with initial data if store is empty
    this.initializeIfNeeded(options.initialData, options.snapshot, options.initialContext);
  }

  private async initializeIfNeeded(
    initialData?: unknown,
    snapshot?: Snapshot,
    initialContext?: HostContext
  ): Promise<void> {
    const existing = await this.store.get();
    if (!existing) {
      if (snapshot) {
        await this.store.save(snapshot);
      } else if (initialData !== undefined) {
        const context =
          initialContext ?? createInitialHostContext(this.loopOptions.context);
        const nextSnapshot = createSnapshot(initialData, this.schema.hash, context);
        await this.store.save(nextSnapshot);
      }
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
   * @param loopOptions - Optional loop options to merge with constructor options
   * @returns Host result with final snapshot and traces
   */
  async dispatch(
    intent: Intent,
    loopOptions?: Partial<HostLoopOptions>
  ): Promise<HostResult> {
    // Wait for initialization
    if (!this.initialized) {
      await this.initializeIfNeeded();
    }

    // Get current snapshot
    let snapshot = await this.store.get();
    if (!snapshot) {
      return {
        status: "error",
        snapshot: createSnapshot(
          {},
          this.schema.hash,
          createInitialHostContext(this.loopOptions.context)
        ),
        traces: [],
        error: createHostError(
          "HOST_NOT_INITIALIZED",
          "No snapshot in store. Initialize the host with initial data."
        ),
      };
    }

    // Run the host loop with merged options
    const mergedOptions: HostLoopOptions = {
      ...this.loopOptions,
      ...loopOptions,
    };
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
    const snapshot = createSnapshot(
      initialData,
      this.schema.hash,
      createInitialHostContext(this.loopOptions.context)
    );
    await this.store.save(snapshot);
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
