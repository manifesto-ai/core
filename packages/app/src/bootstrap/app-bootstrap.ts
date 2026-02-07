/**
 * App Bootstrap
 *
 * Handles the `created → ready` transition.
 * Resolves schema, assembles all runtime components, initializes plugins.
 * Runs once during `ready()`, then is no longer needed.
 *
 * @see ADR-004 Phase 4
 * @module
 */

import type { DomainSchema, Snapshot } from "@manifesto-ai/core";
import { extractDefaults } from "@manifesto-ai/core";
import type {
  ActionHandle,
  ActOptions,
  App,
  AppConfig,
  AppHooks,
  AppRef,
  AppState,
  Branch,
  Effects,
  ErrorValue,
  Host,
  HostResult,
  MemoryFacade,
  MigrationLink,
  PolicyService,
  WorldStore,
} from "../core/types/index.js";

import type { LifecycleManager } from "../core/lifecycle/index.js";
import type { SchemaManager } from "../core/schema/index.js";
import type {
  ActionQueue,
  LivenessGuard,
  ProposalManager,
} from "../execution/index.js";
import type { WorldHeadTracker } from "../storage/world/index.js";
import { SubscriptionStore } from "../runtime/subscription/index.js";
import { BranchManager } from "../storage/branch/index.js";
import { createMemoryFacade } from "../runtime/memory/index.js";
import { SystemRuntime, createSystemFacade } from "../runtime/system/index.js";
import { createInternalHost } from "../execution/internal-host.js";
import {
  createAppExecutor,
  createHostInitializer,
  createSystemActionExecutor,
} from "../execution/index.js";
import { createInitialAppState } from "../core/state/index.js";
import { createAppRef, type AppRefCallbacks } from "../hooks/index.js";
import {
  MissingDefaultActorError,
  PluginInitError,
} from "../errors/index.js";
import { RESERVED_EFFECT_TYPE } from "../constants.js";
import {
  validateSchemaCompatibilityWithEffects,
  SchemaIncompatibleError,
} from "../storage/branch/schema-compatibility.js";

import { AppRuntime } from "../runtime/app-runtime.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Dependencies injected from ManifestoApp constructor.
 */
export interface AppBootstrapDeps {
  readonly config: AppConfig;
  readonly worldStore: WorldStore;
  readonly policyService: PolicyService;
  readonly lifecycleManager: LifecycleManager;
  readonly schemaManager: SchemaManager;
  readonly proposalManager: ProposalManager;
  readonly actionQueue: ActionQueue;
  readonly livenessGuard: LivenessGuard;
  readonly worldHeadTracker: WorldHeadTracker;
  readonly subscriptionStore: SubscriptionStore;
  readonly effects: Effects;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * App Bootstrap — runs once during ready().
 *
 * @see ADR-004 Phase 4
 */
export class AppBootstrap {
  private readonly _deps: AppBootstrapDeps;

  constructor(deps: AppBootstrapDeps) {
    this._deps = deps;

    // Register configured hooks immediately
    this._registerConfiguredHooks();
  }

  /**
   * Assemble all runtime components and return AppRuntime.
   *
   * @param app - The App facade (needed for plugin initialization)
   */
  async assemble(app: App): Promise<AppRuntime> {
    const {
      config,
      worldStore,
      policyService,
      lifecycleManager,
      schemaManager,
      proposalManager,
      actionQueue,
      livenessGuard,
      worldHeadTracker,
      subscriptionStore,
      effects,
    } = this._deps;

    // 0. Forward-declare runtime & create AppRef early
    // AppRef callbacks use lazy binding (closures over `runtime`),
    // so AppRef can be created before runtime exists.
    // This must happen before step 1 because hooks need AppRef for HookContext.
    let runtime!: AppRuntime;

    const queue = lifecycleManager.getHookableImpl().getJobQueue();
    const appRefCallbacks: AppRefCallbacks = {
      getStatus: () => lifecycleManager.status,
      getState: <T>() => runtime.getState() as AppState<T>,
      getDomainSchema: () => runtime.getDomainSchema(),
      getCurrentHead: () => runtime.getCurrentHead(),
      currentBranch: () => runtime.currentBranch(),
      generateProposalId: () => proposalManager.generateProposalId(),
    };

    const appRef = createAppRef(
      appRefCallbacks,
      queue,
      (proposalId, type, input, opts) => {
        runtime.enqueueActionFromHook(proposalId, type, input, opts);
      }
    );

    lifecycleManager.setAppRef(appRef);

    // 1. Emit app:ready:before
    await lifecycleManager.emitHook(
      "app:ready:before",
      lifecycleManager.createHookContext()
    );

    // 2. Validate actor policy
    const defaultActorId = this._validateActorPolicy();

    // 3. Compile domain if MEL text
    await schemaManager.compile();

    // 4. Validate reserved namespaces (NS-ACT-2)
    schemaManager.validateReservedNamespaces();

    // 5. Cache schema, mark resolved
    const schema = schemaManager.getSchema();
    schemaManager.cacheSchema(schema);
    schemaManager.markResolved();

    // 6. Emit domain:resolved hook
    await lifecycleManager.emitHook(
      "domain:resolved",
      { schemaHash: schema.hash, schema },
      {}
    );

    // 7. Create initial state (schema defaults < config.initialData)
    const schemaHash = schemaManager.getCurrentSchemaHash();
    const schemaDefaults = extractDefaults(schema.state);
    const initialState = createInitialAppState(schemaHash, config.initialData, schemaDefaults);
    subscriptionStore.setState(initialState);

    // 8. Create runtime (AppRuntime needs to exist for callbacks)
    // We create it with a deferred pattern: build all components first,
    // then construct AppRuntime with the full deps.

    // State holder — AppRuntime will own this after construction
    let currentState = initialState;

    // 8a. BranchManager
    const branchManager: BranchManager = new BranchManager({
      schemaHash,
      initialState,
      callbacks: {
        executeAction: (branchId: string, type: string, input: unknown, opts?: ActOptions): ActionHandle => {
          // Delegated to runtime.act() after construction
          return runtime.act(type, input, { ...opts, branchId });
        },
        getStateForBranch: () => currentState,
      },
      getRegisteredEffectTypes: () => [
        ...Object.keys(effects),
        RESERVED_EFFECT_TYPE,
      ],
    });

    // 8b. MemoryFacade
    const memoryFacade = createMemoryFacade(
      config.memory,
      schemaHash,
      {
        getDefaultActorId: () => defaultActorId,
        getCurrentBranchId: () => branchManager.currentBranchId ?? "main",
        getBranchHead: (branchId) => {
          try {
            const branches = branchManager.listBranches();
            const branch = branches.find((b: Branch) => b.id === branchId);
            return branch?.head();
          } catch {
            return undefined;
          }
        },
        branchExists: (branchId) => {
          try {
            const branches = branchManager.listBranches();
            return branches.some((b: Branch) => b.id === branchId);
          } catch {
            return false;
          }
        },
      }
    );

    // 8c. SystemRuntime
    const systemRuntime = new SystemRuntime({
      memoryFacade,
    });

    // 8d. SystemActionExecutor
    const systemActionExecutor = createSystemActionExecutor({
      config,
      lifecycleManager,
      systemRuntime,
      defaultActorId,
    });

    // 8e. SystemFacade
    const systemFacade = createSystemFacade({
      act: (type, input, actOpts) => runtime.act(type, input, actOpts),
    });

    // 8f. Internal Host
    const internalHost = createInternalHost({
      schema,
      effects,
      initialData: config.initialData,
    });

    const host: Host = {
      dispatch: async (intent): Promise<HostResult> => {
        const result = await internalHost.dispatch(intent);
        return {
          status: result.status === "complete" ? "complete" : "error",
          snapshot: result.snapshot as Snapshot,
          error: result.error as ErrorValue | undefined,
        };
      },
      registerEffect: (_type, _handler) => {
        console.warn(
          "[Manifesto] registerEffect() is deprecated. " +
          "Provide effects via createApp({ effects }) instead."
        );
      },
      getRegisteredEffectTypes: () => internalHost.getEffectTypes(),
      reset: async (data) => {
        internalHost.reset(data);
      },
    };

    // 8g. HostInitializer → genesis world
    const hostInitializer = createHostInitializer({
      host,
      worldStore,
      policyService,
      domainSchema: schema,
      options: config,
      worldHeadTracker,
      branchManager,
      currentState: initialState,
    });

    const { hostExecutor } = hostInitializer.initialize();
    await hostInitializer.initializeGenesisWorld();

    // 8h. AppExecutor
    const executor = createAppExecutor({
      domainSchema: schema,
      defaultActorId,
      policyService,
      hostExecutor,
      worldStore,
      lifecycleManager,
      proposalManager,
      livenessGuard,
      worldHeadTracker,
      memoryFacade,
      branchManager,
      subscriptionStore,
      schedulerOptions: config.scheduler,
      getCurrentState: () => runtime.getCurrentState(),
      setCurrentState: (state) => { runtime.setCurrentState(state); },
    });

    // 9. Construct AppRuntime
    runtime = new AppRuntime({
      lifecycleManager,
      schemaManager,
      proposalManager,
      actionQueue,
      livenessGuard,
      worldHeadTracker,
      subscriptionStore,
      config,
      defaultActorId,
      effects,
      migrationLinks: [],
      branchManager,
      memoryFacade,
      systemRuntime,
      systemFacade,
      systemActionExecutor,
      host,
      hostExecutor,
      executor,
      worldStore,
      policyService,
      appRef,
      initialState,
    });

    // Wire currentState getter to runtime
    // (BranchManager callback uses currentState which is now in runtime)
    currentState = runtime.getCurrentState();

    // 10. Validate effects (strict mode)
    this._validateEffects(schema, effects);

    // Note: Plugin initialization is NOT done here.
    // It runs in ManifestoApp.ready() after _runtime is set,
    // so plugins can access app APIs (e.g. getDomainSchema()).

    return runtime;
  }

  // ===========================================================================
  // Private Helpers (moved from ManifestoApp)
  // ===========================================================================

  private _validateActorPolicy(): string {
    const policy = this._deps.config.actorPolicy;

    if (policy?.mode === "require" && !policy.defaultActor) {
      throw new MissingDefaultActorError();
    }

    if (policy?.defaultActor) {
      return policy.defaultActor.actorId;
    }

    return "anonymous";
  }

  private _validateEffects(schema: DomainSchema, effects: Effects): void {
    const mode = this._deps.config.validation?.effects ?? "off";
    if (mode === "off") {
      return;
    }

    const result = validateSchemaCompatibilityWithEffects(schema, effects);

    if (result.compatible) {
      return;
    }

    if (mode === "warn") {
      console.warn(
        `[Manifesto] Missing effect handlers: ${result.missingEffects?.join(", ") ?? ""}`
      );
      return;
    }

    throw new SchemaIncompatibleError(result.missingEffects ?? []);
  }

  async initializePlugins(app: App): Promise<void> {
    const plugins = this._deps.config.plugins;
    if (!plugins) return;

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      try {
        await plugin(app);
      } catch (error) {
        throw new PluginInitError(
          i,
          error instanceof Error ? error.message : String(error),
          { cause: error }
        );
      }
    }
  }

  private _registerConfiguredHooks(): void {
    const hooks = this._deps.config.hooks;
    if (!hooks) return;

    const hookable = this._deps.lifecycleManager.hooks;
    for (const [name, handler] of Object.entries(hooks)) {
      if (typeof handler !== "function") continue;
      hookable.on(name as keyof AppHooks, handler as AppHooks[keyof AppHooks]);
    }
  }
}
