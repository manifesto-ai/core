/**
 * Domain Executor
 *
 * The DomainExecutor bridges @manifesto-ai/app and @manifesto-ai/host.
 * It manages the ManifestoHost instance and coordinates action execution.
 *
 * Responsibilities:
 * - Owns/caches ManifestoHost instance
 * - Adapts ServiceHandler → EffectHandler
 * - Converts AppState ↔ Snapshot
 * - Maps HostResult → ActionResult
 *
 * @see Plan: lucky-splashing-curry.md
 */

import {
  createHost,
  createIntent,
  type ManifestoHost,
  type HostResult,
  type DomainSchema,
  type Snapshot,
  type Intent,
} from "@manifesto-ai/host";
import type {
  ServiceMap,
  AppState,
  ActionResult,
  RuntimeKind,
  ErrorValue,
} from "../types/index.js";
import {
  adaptServiceToEffect,
  createPatchHelpers,
  type AdapterContextValues,
} from "./adapter.js";
import {
  mapHostResultToActionResult,
  errorToErrorValue,
} from "./result-mapper.js";

// =============================================================================
// Schema Normalization
// =============================================================================

/**
 * Normalize a flow to handle legacy formats.
 */
function normalizeFlow(flow: any): any {
  if (!flow || typeof flow !== "object") {
    return { kind: "halt", reason: "empty" };
  }

  // Convert legacy "noop" to "halt"
  if (flow.kind === "noop") {
    return { kind: "halt", reason: "noop" };
  }

  // Recursively normalize nested flows (seq, if, etc.)
  if (flow.kind === "seq" && Array.isArray(flow.steps)) {
    return {
      ...flow,
      steps: flow.steps.map(normalizeFlow),
    };
  }
  if (flow.kind === "if") {
    const normalized: any = { ...flow };
    if (flow.then) normalized.then = normalizeFlow(flow.then);
    if (flow.else) normalized.else = normalizeFlow(flow.else);
    return normalized;
  }

  return flow;
}

/**
 * Normalize a DomainSchema to ensure all required fields are present.
 * Handles legacy schema formats that may be missing nested fields.
 */
function normalizeSchema(schema: DomainSchema): DomainSchema {
  const normalized = { ...schema };

  // Ensure state.fields exists
  if (!normalized.state || typeof normalized.state !== "object") {
    normalized.state = { fields: {} };
  } else if (!("fields" in normalized.state)) {
    normalized.state = { fields: {} };
  }

  // Ensure computed.fields exists
  if (!normalized.computed || typeof normalized.computed !== "object") {
    normalized.computed = { fields: {} };
  } else if (!("fields" in normalized.computed)) {
    normalized.computed = { fields: {} };
  }

  // Ensure types exists
  if (!normalized.types || typeof normalized.types !== "object") {
    normalized.types = {};
  }

  // Ensure id and version exist
  if (!normalized.id) {
    normalized.id = "unknown";
  }
  if (!normalized.version) {
    normalized.version = "0.0.0";
  }

  // Handle legacy schemaHash field (map to hash)
  if (!normalized.hash && (normalized as any).schemaHash) {
    normalized.hash = (normalized as any).schemaHash;
  }

  // Normalize action flows
  if (normalized.actions && typeof normalized.actions === "object") {
    const normalizedActions: Record<string, any> = {};
    for (const [key, action] of Object.entries(normalized.actions)) {
      if (action && typeof action === "object" && "flow" in action) {
        normalizedActions[key] = {
          ...action,
          flow: normalizeFlow((action as any).flow),
        };
      } else {
        normalizedActions[key] = action;
      }
    }
    normalized.actions = normalizedActions;
  }

  return normalized;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Input for executing an action
 */
export interface ExecuteActionInput {
  /** Action type (e.g., "todo.add") */
  actionType: string;

  /** Action input parameters */
  input: Record<string, unknown>;

  /** Proposal ID for tracking */
  proposalId: string;

  /** Actor executing the action */
  actorId: string;

  /** World ID for the execution */
  worldId: string;

  /** Branch ID for the execution */
  branchId: string;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Output from executing an action
 */
export interface ExecuteActionOutput {
  /** The action result */
  result: ActionResult;

  /** The new state after execution */
  newState: AppState<unknown>;

  /** Number of effects executed */
  effectCount: number;

  /** Number of patches applied */
  patchCount: number;
}

/**
 * Options for creating a DomainExecutor
 */
export interface DomainExecutorOptions {
  /** The domain schema */
  schema: DomainSchema;

  /** ServiceMap with effect handlers */
  services: ServiceMap;

  /** Initial state */
  initialState: AppState<unknown>;
}

// =============================================================================
// State Conversion
// =============================================================================

/**
 * Convert AppState to Host Snapshot.
 */
function appStateToSnapshot(state: AppState<unknown>, schema: DomainSchema): Snapshot {
  return {
    data: state.data as Record<string, unknown>,
    computed: state.computed,
    input: {},
    system: {
      status: state.system.status === "computing" ? "computing" :
              state.system.status === "pending" ? "pending" :
              state.system.status === "error" ? "error" : "idle",
      lastError: state.system.lastError,
      errors: state.system.errors as ErrorValue[],
      pendingRequirements: state.system.pendingRequirements as Snapshot["system"]["pendingRequirements"],
      currentAction: state.system.currentAction,
    },
    meta: {
      version: state.meta.version,
      timestamp: state.meta.timestamp,
      randomSeed: state.meta.randomSeed,
      schemaHash: state.meta.schemaHash,
    },
  };
}

/**
 * Convert Host Snapshot to AppState.
 */
function snapshotToAppState(snapshot: Snapshot): AppState<unknown> {
  return {
    data: snapshot.data,
    computed: snapshot.computed,
    system: {
      status: snapshot.system.status === "computing" ? "computing" :
              snapshot.system.status === "pending" ? "pending" :
              snapshot.system.status === "error" ? "error" : "idle",
      lastError: snapshot.system.lastError ?? null,
      errors: snapshot.system.errors ?? [],
      pendingRequirements: snapshot.system.pendingRequirements ?? [],
      currentAction: snapshot.system.currentAction ?? null,
    },
    meta: {
      version: snapshot.meta.version,
      timestamp: snapshot.meta.timestamp,
      randomSeed: snapshot.meta.randomSeed,
      schemaHash: snapshot.meta.schemaHash,
    },
  };
}

// =============================================================================
// Domain Executor
// =============================================================================

/**
 * DomainExecutor bridges App and Host.
 *
 * It manages the Host instance and coordinates action execution by:
 * 1. Adapting ServiceHandlers to EffectHandlers
 * 2. Converting state between AppState and Snapshot
 * 3. Mapping Host results to Action results
 *
 * @deprecated Use v2 API with `createApp({ host, worldStore, ... })` instead.
 * This class will be removed in v3.0.0.
 * @see APP-SPEC-v2.0.0 for migration guide
 */
export class DomainExecutor {
  private _host: ManifestoHost;
  private _schema: DomainSchema;
  private _services: ServiceMap;
  private _currentContext: AdapterContextValues | null = null;
  private _effectCount = 0;
  private _patchCount = 0;

  constructor(options: DomainExecutorOptions) {
    // Normalize schema to handle legacy formats
    this._schema = normalizeSchema(options.schema);
    this._services = options.services;

    // Create Host with initial data from state
    this._host = createHost(this._schema, {
      initialData: options.initialState.data,
    });

    // Register all service handlers as effect handlers
    this._registerServices();
  }

  /**
   * Register all services from ServiceMap as effect handlers.
   */
  private _registerServices(): void {
    for (const [type, handler] of Object.entries(this._services)) {
      const effectHandler = adaptServiceToEffect(handler, {
        getContext: () => {
          if (!this._currentContext) {
            throw new Error("DomainExecutor: No execution context available");
          }
          return this._currentContext;
        },
      });

      // Wrap to count effects
      const countingHandler = async (
        t: string,
        params: Record<string, unknown>,
        ctx: Parameters<typeof effectHandler>[2]
      ) => {
        this._effectCount++;
        const patches = await effectHandler(t, params, ctx);
        this._patchCount += patches.length;
        return patches;
      };

      this._host.registerEffect(type, countingHandler);
    }
  }

  /**
   * Execute an action and return the result.
   */
  async execute(input: ExecuteActionInput): Promise<ExecuteActionOutput> {
    const startTime = Date.now();

    // Reset counters
    this._effectCount = 0;
    this._patchCount = 0;

    // Set current context for effect handlers
    this._currentContext = {
      actorId: input.actorId,
      worldId: input.worldId,
      branchId: input.branchId,
      signal: input.signal ?? new AbortController().signal,
    };

    try {
      // Check if action exists in schema
      const actionDef = this._schema.actions[input.actionType];
      if (!actionDef) {
        return this._createNotFoundResult(input, startTime);
      }

      // Create intent with intentId (using proposalId as the base)
      const intentId = `intent_${input.proposalId}_${Date.now().toString(36)}`;
      const intent: Intent = createIntent(input.actionType, input.input, intentId);

      // Dispatch to host
      const hostResult: HostResult = await this._host.dispatch(intent);

      // Map result
      const actionResult = mapHostResultToActionResult(hostResult, {
        proposalId: input.proposalId,
        decisionId: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        worldId: input.worldId,
        runtime: "domain" as RuntimeKind,
        startTime,
        effectCount: this._effectCount,
        patchCount: this._patchCount,
      });

      // Convert snapshot to AppState
      const newState = snapshotToAppState(hostResult.snapshot);

      return {
        result: actionResult,
        newState,
        effectCount: this._effectCount,
        patchCount: this._patchCount,
      };
    } catch (error) {
      // Handle unexpected errors
      return this._createErrorResult(input, error, startTime);
    } finally {
      // Clear context
      this._currentContext = null;
    }
  }

  /**
   * Create a "not found" error result.
   */
  private _createNotFoundResult(
    input: ExecuteActionInput,
    startTime: number
  ): ExecuteActionOutput {
    const errorValue: ErrorValue = {
      code: "ACTION_NOT_FOUND",
      message: `Action "${input.actionType}" not found in schema`,
      source: {
        actionId: input.proposalId,
        nodePath: "schema.actions",
      },
      timestamp: Date.now(),
      context: { actionType: input.actionType },
    };

    return {
      result: {
        status: "failed",
        proposalId: input.proposalId,
        decisionId: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        error: errorValue,
        worldId: input.worldId,
        runtime: "domain",
      },
      newState: this._getCurrentState(),
      effectCount: 0,
      patchCount: 0,
    };
  }

  /**
   * Create an error result from an exception.
   */
  private _createErrorResult(
    input: ExecuteActionInput,
    error: unknown,
    startTime: number
  ): ExecuteActionOutput {
    const errorValue = errorToErrorValue(error, {
      actionId: input.proposalId,
      nodePath: "domain-executor",
    });

    return {
      result: {
        status: "failed",
        proposalId: input.proposalId,
        decisionId: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        error: errorValue,
        worldId: input.worldId,
        runtime: "domain",
      },
      newState: this._getCurrentState(),
      effectCount: this._effectCount,
      patchCount: this._patchCount,
    };
  }

  /**
   * Get the current state from Host.
   */
  private _getCurrentState(): AppState<unknown> {
    // Get snapshot synchronously is not available,
    // so we return a minimal state
    return {
      data: {},
      computed: {},
      system: {
        status: "idle",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: null,
      },
      meta: {
        version: 0,
        timestamp: Date.now(),
        randomSeed: "seed",
        schemaHash: this._schema.hash,
      },
    };
  }

  /**
   * Sync state with Host (for checkout operations).
   */
  async syncState(state: AppState<unknown>): Promise<void> {
    await this._host.reset(state.data);
  }

  /**
   * Register a new effect handler.
   */
  registerEffect(type: string, handler: (params: Record<string, unknown>, ctx: any) => any): void {
    this._services[type] = handler;

    const effectHandler = adaptServiceToEffect(handler, {
      getContext: () => {
        if (!this._currentContext) {
          throw new Error("DomainExecutor: No execution context available");
        }
        return this._currentContext;
      },
    });

    this._host.registerEffect(type, effectHandler);
  }

  /**
   * Get the underlying host (for advanced use cases).
   */
  getHost(): ManifestoHost {
    return this._host;
  }

  /**
   * Get the schema.
   */
  getSchema(): DomainSchema {
    return this._schema;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a DomainExecutor.
 */
export function createDomainExecutor(
  options: DomainExecutorOptions
): DomainExecutor {
  return new DomainExecutor(options);
}
