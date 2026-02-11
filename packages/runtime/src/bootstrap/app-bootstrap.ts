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

import type { DomainSchema } from "@manifesto-ai/core";
import { extractDefaults, evaluateComputed, isOk } from "@manifesto-ai/core";
import type {
  ActOptions,
  App,
  AppConfig,
  AppHooks,
  AppState,
  Effects,
  PolicyService,
  WorldStore,
} from "@manifesto-ai/shared";
import {
  createInitialAppState,
  toClientState,
  MissingDefaultActorError,
  PluginInitError,
} from "@manifesto-ai/shared";

import type { LifecycleManager } from "../core/lifecycle/index.js";
import type { SchemaManager } from "../core/schema/index.js";
import type {
  ActionQueue,
  LivenessGuard,
  ProposalManager,
} from "../execution/index.js";
import type { WorldHeadTracker } from "../storage/world/index.js";
import { SubscriptionStore } from "../runtime/subscription/index.js";
import { appStateToSnapshot } from "../execution/state-converter.js";
import { createAppRef, type AppRefCallbacks } from "../hooks/index.js";
import {
  validateSchemaCompatibilityWithEffects,
  SchemaIncompatibleError,
} from "../storage/branch/schema-compatibility.js";

import { AppRuntime } from "../runtime/app-runtime.js";
import { assembleComponents } from "./component-assembler.js";

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
    let initialState = createInitialAppState(schemaHash, config.initialData, schemaDefaults);

    // 8. Evaluate genesis computed values (READY-8)
    const genesisSnapshot = appStateToSnapshot(initialState);
    const computedResult = evaluateComputed(schema, genesisSnapshot);
    if (isOk(computedResult)) {
      initialState = toClientState({ ...initialState, computed: computedResult.value });
    }

    subscriptionStore.setState(initialState);

    // 8. Assemble runtime components via ComponentAssembler
    // Forward-declare runtime for late-binding callbacks.
    const binder = {
      act: (type: string, input: unknown, opts?: ActOptions) =>
        runtime.act(type, input, opts),
      getCurrentState: () => runtime.getCurrentState(),
      setCurrentState: (state: AppState<unknown>) => {
        runtime.setCurrentState(state);
      },
    };

    const components = await assembleComponents(
      {
        config,
        schema,
        schemaHash,
        initialState,
        defaultActorId,
        effects,
        worldStore,
        policyService,
        lifecycleManager,
        schemaManager,
        proposalManager,
        actionQueue,
        livenessGuard,
        worldHeadTracker,
        subscriptionStore,
      },
      binder,
    );

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
      ...components,
      worldStore,
      policyService,
      appRef,
      initialState,
    });

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
