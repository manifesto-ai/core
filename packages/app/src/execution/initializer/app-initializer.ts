/**
 * App Initializer Module
 *
 * Orchestrates App initialization sequence.
 *
 * @see SPEC §5.6 ready()
 * @module
 */

import type { DomainSchema, Patch } from "@manifesto-ai/core";
import type {
  App,
  AppState,
  CreateAppOptions,
  MemoryHubConfig,
} from "../../core/types/index.js";
import type { LifecycleManager } from "../../core/lifecycle/index.js";
import type { SchemaManager } from "../../core/schema/index.js";
import { createInitialAppState } from "../../core/state/index.js";
import { BranchManager } from "../../storage/branch/index.js";
import { SubscriptionStore } from "../../runtime/subscription/index.js";
import { ServiceRegistry } from "../../runtime/services/index.js";
import { createMemoryFacade } from "../../runtime/memory/index.js";
import { SystemRuntime, createSystemFacade } from "../../runtime/system/index.js";
import { PluginInitError } from "../../errors/index.js";
import { DomainExecutor } from "../index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Initialized components from AppInitializer.
 */
export interface InitializedComponents {
  currentState: AppState<unknown>;
  branchManager: BranchManager;
  subscriptionStore: SubscriptionStore;
  serviceRegistry: ServiceRegistry;
  systemRuntime: SystemRuntime;
  systemFacade: ReturnType<typeof createSystemFacade>;
  memoryFacade: ReturnType<typeof createMemoryFacade>;
  domainExecutor: DomainExecutor | null;
}

/**
 * App Initializer dependencies.
 */
export interface AppInitializerDependencies {
  app: App;
  options: CreateAppOptions;
  lifecycleManager: LifecycleManager;
  schemaManager: SchemaManager;
  v2Enabled: boolean;
  getRegisteredEffectTypes?: () => readonly string[];
}

/**
 * App Initializer interface.
 */
export interface AppInitializer {
  /**
   * Initialize plugins.
   *
   * @see SPEC §15.2
   */
  initializePlugins(): Promise<void>;

  /**
   * Initialize state and components.
   *
   * @see SPEC §7 State Model
   */
  initializeState(): InitializedComponents;

  /**
   * Validate services.
   *
   * @see SPEC §13.3 SVC-1~5
   */
  validateServices(): ServiceRegistry;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * App Initializer implementation.
 */
export class AppInitializerImpl implements AppInitializer {
  private _deps: AppInitializerDependencies;

  constructor(deps: AppInitializerDependencies) {
    this._deps = deps;
  }

  async initializePlugins(): Promise<void> {
    const plugins = this._deps.options.plugins;
    if (!plugins) return;

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      try {
        await plugin(this._deps.app);
      } catch (error) {
        throw new PluginInitError(
          i,
          error instanceof Error ? error.message : String(error),
          { cause: error }
        );
      }
    }
  }

  validateServices(): ServiceRegistry {
    const services = this._deps.options.services ?? {};
    const validationMode = this._deps.options.validation?.services ?? "lazy";

    // Extract effect types from schema (if available)
    const effectTypes: string[] = [];

    // Create service registry with validation mode
    const serviceRegistry = new ServiceRegistry(services, {
      validationMode: validationMode === "strict" ? "strict" : "lazy",
      knownEffectTypes: effectTypes,
    });

    // Validate services (throws on errors)
    serviceRegistry.validate(effectTypes);

    return serviceRegistry;
  }

  initializeState(): InitializedComponents {
    const { options, schemaManager, v2Enabled, getRegisteredEffectTypes } = this._deps;

    const schemaHash = schemaManager.getCurrentSchemaHash();
    const initialData = options.initialData;
    const currentState = createInitialAppState(schemaHash, initialData);

    // Initialize subscription store
    const subscriptionStore = new SubscriptionStore();
    subscriptionStore.setState(currentState);

    // Initialize branch manager
    const branchManager = new BranchManager({
      schemaHash,
      initialState: currentState,
      callbacks: {
        executeAction: () => {
          throw new Error("Branch callback not wired yet");
        },
        getStateForBranch: () => currentState,
      },
      getRegisteredEffectTypes: v2Enabled ? getRegisteredEffectTypes : undefined,
    });

    // Initialize memory facade
    const memoryFacade = createMemoryFacade(
      options.memory,
      schemaHash,
      {
        getDefaultActorId: () => "anonymous",
        getCurrentBranchId: () => branchManager.currentBranchId ?? "main",
        getBranchHead: (branchId) => {
          try {
            const branches = branchManager.listBranches();
            const branch = branches.find((b) => b.id === branchId);
            return branch?.head();
          } catch {
            return undefined;
          }
        },
        branchExists: (branchId) => {
          try {
            const branches = branchManager.listBranches();
            return branches.some((b) => b.id === branchId);
          } catch {
            return false;
          }
        },
      }
    );

    // Initialize System Runtime
    const systemRuntime = new SystemRuntime({
      initialActors: options.actorPolicy?.defaultActor
        ? [
            {
              actorId: options.actorPolicy.defaultActor.actorId,
              kind: options.actorPolicy.defaultActor.kind ?? "human",
              name: options.actorPolicy.defaultActor.name,
              meta: options.actorPolicy.defaultActor.meta,
            },
          ]
        : [],
      memoryProviders: options.memory
        ? Object.keys(
            (options.memory as { providers?: Record<string, unknown> }).providers ?? {}
          )
        : [],
      defaultMemoryProvider:
        options.memory && typeof options.memory === "object"
          ? (options.memory.defaultProvider ?? "")
          : "",
    });

    // Create System Facade
    const systemFacade = createSystemFacade(systemRuntime);

    // Wire memory facade to System Runtime
    systemRuntime.setMemoryFacade(memoryFacade);

    // Initialize service registry
    const serviceRegistry = this.validateServices();

    // Initialize domain executor for legacy mode
    let domainExecutor: DomainExecutor | null = null;
    if (!v2Enabled) {
      domainExecutor = new DomainExecutor({
        schema: schemaManager.getSchema(),
        services: options.services ?? {},
        initialState: currentState,
      });
    }

    return {
      currentState,
      branchManager,
      subscriptionStore,
      serviceRegistry,
      systemRuntime,
      systemFacade,
      memoryFacade,
      domainExecutor,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new AppInitializer instance.
 *
 * @param deps - The initializer dependencies
 */
export function createAppInitializer(deps: AppInitializerDependencies): AppInitializer {
  return new AppInitializerImpl(deps);
}
