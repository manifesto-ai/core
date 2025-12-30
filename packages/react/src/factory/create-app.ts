/**
 * createManifestoApp - Zero-config factory for Manifesto React apps
 *
 * Handles all internal wiring (Host, World, Bridge) and provides
 * a simple, type-safe API for React components.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { createSnapshot } from "@manifesto-ai/core";
import { createHost } from "@manifesto-ai/host";
import {
  createManifestoWorld,
  type ActorRef,
  type HostInterface,
} from "@manifesto-ai/world";
import {
  createBridge,
  type Bridge,
  type SnapshotView,
} from "@manifesto-ai/bridge";
import type {
  DomainModule,
  ActionRef,
  ComputedRef,
  ManifestoAppOptions,
  ActionDispatchers,
} from "./types.js";

// ============================================================================
// Internal Types
// ============================================================================

interface AppContextValue<TState> {
  bridge: Bridge;
  snapshot: SnapshotView | null;
  state: TState | null;
  computed: Record<string, unknown>;
  actions: Record<string, ActionRef<unknown>>;
}

// ============================================================================
// Result Type
// ============================================================================

/**
 * The result of createManifestoApp
 */
export interface ManifestoAppResult<
  TState,
  TComputed extends Record<string, ComputedRef<unknown>>,
  TActions extends Record<string, ActionRef<unknown>>
> {
  Provider: React.FC<{ children: ReactNode }>;
  useValue: <T>(selector: (state: TState) => T) => T;
  useComputed: <T>(selector: (computed: ComputedValues<TComputed>) => T) => T;
  useActions: () => ActionDispatchers<TActions>;
  useBridge: () => Bridge;
}

/**
 * Extract computed values from ComputedRef map
 */
type ComputedValues<T extends Record<string, ComputedRef<unknown>>> = {
  [K in keyof T]: T[K] extends ComputedRef<infer V> ? V : never;
};

// ============================================================================
// createManifestoApp
// ============================================================================

/**
 * Create a Manifesto app with zero boilerplate
 *
 * @example
 * ```tsx
 * import { createManifestoApp } from "@manifesto-ai/react";
 * import { TodoDomain, initialState } from "./domain";
 *
 * const TodoApp = createManifestoApp(TodoDomain, { initialState });
 *
 * function App() {
 *   return (
 *     <TodoApp.Provider>
 *       <TodoList />
 *     </TodoApp.Provider>
 *   );
 * }
 *
 * function TodoList() {
 *   const todos = TodoApp.useValue(s => s.todos);
 *   const { add, toggle } = TodoApp.useActions();
 *
 *   return (
 *     <ul>
 *       {todos.map(t => (
 *         <li key={t.id} onClick={() => toggle({ id: t.id })}>
 *           {t.title}
 *         </li>
 *       ))}
 *       <button onClick={() => add({ title: "New Todo" })}>Add</button>
 *     </ul>
 *   );
 * }
 * ```
 */
export function createManifestoApp<
  TState,
  TComputed extends Record<string, ComputedRef<unknown>>,
  TActions extends Record<string, ActionRef<unknown>>
>(
  domain: DomainModule<TState, TComputed, TActions>,
  options: ManifestoAppOptions<TState>
): ManifestoAppResult<TState, TComputed, TActions> {
  // ============================================================================
  // Internal State (created once per createManifestoApp call)
  // ============================================================================

  // Create default actor if not provided
  const defaultActor: ActorRef = options.actor ?? {
    actorId: `actor-${crypto.randomUUID()}`,
    kind: "system",
  };

  // Create Host - wraps Core and handles effect execution
  const host = createHost(domain.schema as Parameters<typeof createHost>[0], {
    initialData: options.initialState,
  });

  // Register effect handlers if provided
  if (options.effectHandlers) {
    for (const [type, handler] of Object.entries(options.effectHandlers)) {
      host.registerEffect(type, handler as Parameters<typeof host.registerEffect>[1]);
    }
  }

  // Create HostInterface adapter for World
  const hostInterface: HostInterface = {
    async dispatch(intent) {
      const result = await host.dispatch(intent);
      return {
        status: result.status === "complete" ? "complete" : "error",
        snapshot: result.snapshot,
      };
    },
  };

  // Create World - handles authority, actors, proposals
  const world = createManifestoWorld({
    schemaHash: domain.schema.hash,
    host: hostInterface,
  });

  // Register the default actor with auto_approve policy
  world.registerActor(defaultActor, options.authority ?? { mode: "auto_approve" });

  // Create Bridge - connects World to React
  const bridge: Bridge = createBridge({
    world,
    schemaHash: domain.schema.hash,
    defaultActor,
  });

  // Register projections if provided
  if (options.projections) {
    for (const projection of options.projections) {
      bridge.registerProjection(projection);
    }
  }

  // Track initialization state
  let initialized = false;
  let initPromise: Promise<void> | null = null;

  // Initialize function - creates genesis and refreshes bridge
  async function initialize(): Promise<void> {
    if (initialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      // Create genesis world with initial snapshot
      const snapshot = createSnapshot(options.initialState, domain.schema.hash);
      await world.createGenesis(snapshot);

      // Refresh bridge to get initial state
      await bridge.refresh();

      initialized = true;
    })();

    return initPromise;
  }

  // ============================================================================
  // Context
  // ============================================================================

  const AppContext = createContext<AppContextValue<TState> | null>(null);

  // ============================================================================
  // Provider Component
  // ============================================================================

  const Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [snapshot, setSnapshot] = useState<SnapshotView | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Initialize on mount
    useEffect(() => {
      let mounted = true;

      initialize().then(() => {
        if (!mounted) return;

        // Subscribe to snapshot changes
        const unsubscribe = bridge.subscribe((newSnapshot) => {
          if (mounted) {
            setSnapshot(newSnapshot);
          }
        });

        setIsReady(true);

        return () => {
          unsubscribe();
        };
      });

      return () => {
        mounted = false;
      };
    }, []);

    // Compute state and computed values from snapshot
    const contextValue = useMemo<AppContextValue<TState> | null>(() => {
      if (!isReady) return null;

      return {
        bridge,
        snapshot,
        state: (snapshot?.data ?? null) as TState | null,
        computed: (snapshot?.computed ?? {}) as Record<string, unknown>,
        actions: domain.actions as Record<string, ActionRef<unknown>>,
      };
    }, [snapshot, isReady]);

    // Don't render children until initialized
    if (!isReady || !contextValue) {
      return null;
    }

    return React.createElement(
      AppContext.Provider,
      { value: contextValue },
      children
    );
  };

  // ============================================================================
  // Hooks
  // ============================================================================

  function useAppContext(): AppContextValue<TState> {
    const ctx = useContext(AppContext);
    if (!ctx) {
      throw new Error(
        "useValue/useComputed/useActions must be used within ManifestoApp.Provider"
      );
    }
    return ctx;
  }

  function useValue<T>(selector: (state: TState) => T): T {
    const { state } = useAppContext();
    if (state === null) {
      throw new Error("State not available");
    }
    return selector(state);
  }

  function useComputed<T>(
    selector: (computed: ComputedValues<TComputed>) => T
  ): T {
    const { computed } = useAppContext();
    return selector(computed as ComputedValues<TComputed>);
  }

  function useActions(): ActionDispatchers<TActions> {
    const { actions } = useAppContext();

    // Create action dispatchers that use bridge.dispatch
    const dispatchers = useMemo(() => {
      const result: Record<string, (input?: unknown) => Promise<void>> = {};

      for (const [name, actionRef] of Object.entries(actions)) {
        result[name] = async (input?: unknown) => {
          // Create IntentBody from ActionRef
          const intentBody = (actionRef.intent as (input?: unknown) => { action: string; input?: unknown })(input);

          // Dispatch via bridge - convert to the format bridge expects
          await bridge.dispatch({
            type: intentBody.action,
            input: intentBody.input,
          });
        };
      }

      return result as ActionDispatchers<TActions>;
    }, [actions]);

    return dispatchers;
  }

  function useBridge(): Bridge {
    return bridge;
  }

  // ============================================================================
  // Return ManifestoApp
  // ============================================================================

  return {
    Provider,
    useValue,
    useComputed,
    useActions,
    useBridge,
  };
}
