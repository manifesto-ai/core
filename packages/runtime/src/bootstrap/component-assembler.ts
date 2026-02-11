/**
 * Component Assembler
 *
 * Wires runtime components during the `created → ready` transition.
 * Called by AppBootstrap after schema resolution and initial state creation.
 *
 * @see ADR-004 Phase 4
 * @module
 */

import type { DomainSchema, Snapshot } from "@manifesto-ai/core";
import { createWorldId } from "@manifesto-ai/world";
import type {
  ActionHandle,
  ActOptions,
  AppConfig,
  AppState,
  Branch,
  Effects,
  ErrorValue,
  Host,
  HostResult,
  MemoryFacade,
  PolicyService,
  SystemFacade,
  WorldStore,
} from "@manifesto-ai/shared";
import { RESERVED_EFFECT_TYPE } from "@manifesto-ai/shared";

import type { LifecycleManager } from "../core/lifecycle/index.js";
import type { SchemaManager } from "../core/schema/index.js";
import type {
  ActionQueue,
  AppExecutor,
  LivenessGuard,
  ProposalManager,
  SystemActionExecutor,
} from "../execution/index.js";
import type { AppHostExecutor } from "../execution/host-executor/index.js";
import type { WorldHeadTracker } from "../storage/world/index.js";
import type { SubscriptionStore } from "../runtime/subscription/index.js";
import type { SystemRuntime } from "../runtime/system/index.js";
import { BranchManager } from "../storage/branch/index.js";
import { createMemoryFacade } from "../runtime/memory/index.js";
import { SystemRuntime as SystemRuntimeImpl, createSystemFacade } from "../runtime/system/index.js";
import { createInternalHost } from "../execution/internal-host.js";
import {
  createAppExecutor,
  createHostInitializer,
  createSystemActionExecutor,
} from "../execution/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Inputs required for component assembly.
 */
export interface AssemblyInput {
  readonly config: AppConfig;
  readonly schema: DomainSchema;
  readonly schemaHash: string;
  readonly initialState: AppState<unknown>;
  readonly defaultActorId: string;
  readonly effects: Effects;
  readonly worldStore: WorldStore;
  readonly policyService: PolicyService;
  readonly lifecycleManager: LifecycleManager;
  readonly schemaManager: SchemaManager;
  readonly proposalManager: ProposalManager;
  readonly actionQueue: ActionQueue;
  readonly livenessGuard: LivenessGuard;
  readonly worldHeadTracker: WorldHeadTracker;
  readonly subscriptionStore: SubscriptionStore;
}

/**
 * Late-binding callbacks for circular dependency resolution.
 *
 * These are closures over the runtime reference that will be assigned
 * after component assembly completes.
 */
export interface RuntimeBinder {
  act(type: string, input: unknown, opts?: ActOptions): ActionHandle;
  getCurrentState(): AppState<unknown>;
  setCurrentState(state: AppState<unknown>): void;
}

/**
 * Assembled components ready for AppRuntime construction.
 */
export interface AssembledComponents {
  readonly branchManager: BranchManager;
  readonly memoryFacade: MemoryFacade;
  readonly systemRuntime: SystemRuntime;
  readonly systemActionExecutor: SystemActionExecutor;
  readonly systemFacade: SystemFacade;
  readonly host: Host;
  readonly hostExecutor: AppHostExecutor;
  readonly executor: AppExecutor;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Assemble all runtime components.
 *
 * Creates BranchManager, MemoryFacade, SystemRuntime, SystemActionExecutor,
 * SystemFacade, Host, HostInitializer (genesis world), and AppExecutor.
 *
 * @param input - Assembly inputs (schema, config, services)
 * @param binder - Late-binding callbacks for circular dependency resolution
 */
export async function assembleComponents(
  input: AssemblyInput,
  binder: RuntimeBinder,
): Promise<AssembledComponents> {
  const {
    config,
    schema,
    schemaHash,
    initialState,
    defaultActorId,
    effects,
    worldStore,
    policyService,
    lifecycleManager,
    proposalManager,
    livenessGuard,
    worldHeadTracker,
    subscriptionStore,
  } = input;

  // 1. BranchManager — attempt resume from persisted state
  const branchManager = await createBranchManager({
    schemaHash,
    initialState,
    effects,
    worldStore,
    binder,
  });

  // 2. MemoryFacade
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

  // 3. SystemRuntime
  const systemRuntime = new SystemRuntimeImpl({
    memoryFacade,
  });

  // 4. SystemActionExecutor
  const systemActionExecutor = createSystemActionExecutor({
    config,
    lifecycleManager,
    systemRuntime,
    defaultActorId,
  });

  // 5. SystemFacade
  const systemFacade = createSystemFacade({
    act: (type, actInput, actOpts) => binder.act(type, actInput, actOpts),
  });

  // 6. Internal Host → Host adapter
  const host = createHostAdapter(schema, effects, config.initialData);

  // 7. HostInitializer → genesis world
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

  // 8. AppExecutor
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
    getCurrentState: () => binder.getCurrentState(),
    setCurrentState: (state) => { binder.setCurrentState(state); },
  });

  return {
    branchManager,
    memoryFacade,
    systemRuntime,
    systemActionExecutor,
    systemFacade,
    host,
    hostExecutor,
    executor,
  };
}

// =============================================================================
// Private Helpers
// =============================================================================

interface BranchManagerInput {
  schemaHash: string;
  initialState: AppState<unknown>;
  effects: Effects;
  worldStore: WorldStore;
  binder: RuntimeBinder;
}

async function createBranchManager(
  input: BranchManagerInput,
): Promise<BranchManager> {
  const { schemaHash, initialState, effects, worldStore, binder } = input;

  const branchManagerConfig = {
    schemaHash,
    initialState,
    callbacks: {
      executeAction: (branchId: string, type: string, actInput: unknown, opts?: ActOptions): ActionHandle => {
        return binder.act(type, actInput, { ...opts, branchId });
      },
      getStateForBranch: () => binder.getCurrentState(),
    },
    getRegisteredEffectTypes: () => [
      ...Object.keys(effects),
      RESERVED_EFFECT_TYPE,
    ],
  };

  const persistedState = worldStore.loadBranchState
    ? await worldStore.loadBranchState()
    : null;

  if (!persistedState || persistedState.branches.length === 0) {
    return new BranchManager(branchManagerConfig);
  }

  // RESUME-SCHEMA-1: Detect schemaHash mismatch
  const mismatchedBranches = persistedState.branches.filter(
    (b) => b.schemaHash !== schemaHash
  );
  if (mismatchedBranches.length > 0) {
    // RESUME-SCHEMA-2: Log warning and fall back to fresh start
    console.warn(
      `[Manifesto] Schema mismatch on resume: branches [${mismatchedBranches.map((b) => b.id).join(", ")}] ` +
      `have different schemaHash. Falling back to fresh start.`
    );
    return new BranchManager(branchManagerConfig);
  }

  // BRANCH-RECOVER-1: Validate head WorldIds exist in WorldStore
  const validBranches = [];
  for (const entry of persistedState.branches) {
    const exists = await worldStore.has(createWorldId(entry.head));
    if (exists) {
      validBranches.push(entry);
    } else {
      // BRANCH-RECOVER-2: Log warning for invalid branch head
      console.warn(
        `[Manifesto] Branch '${entry.id}' head '${entry.head}' not found in WorldStore. ` +
        `Branch will be excluded from resume.`
      );
    }
  }

  if (validBranches.length === 0) {
    console.warn(
      `[Manifesto] All persisted branch heads are invalid. Starting fresh.`
    );
    return new BranchManager(branchManagerConfig);
  }

  // BRANCH-RECOVER-3: Resume with valid branches only
  const validPersistedState = {
    branches: validBranches,
    activeBranchId: validBranches.some((b) => b.id === persistedState.activeBranchId)
      ? persistedState.activeBranchId
      : validBranches[0].id,
  };

  return BranchManager.fromPersistedState(
    validPersistedState,
    branchManagerConfig
  );
}

function createHostAdapter(
  schema: DomainSchema,
  effects: Effects,
  initialData?: unknown,
): Host {
  const internalHost = createInternalHost({
    schema,
    effects,
    initialData,
  });

  return {
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
}
