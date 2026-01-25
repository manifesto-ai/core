/**
 * Type utilities for createManifestoApp
 *
 * Provides type inference from DomainModule to React hooks.
 */
import type { ReactNode } from "react";
import type { Bridge, Projection } from "@manifesto-ai/bridge";
import type { ActorRef, AuthorityPolicy } from "@manifesto-ai/world";

// Re-declare types we need from builder/host to avoid hard dependency
// These are structural types that will match the actual implementations

/**
 * Minimal ActionRef interface (matches @manifesto-ai/builder)
 */
export interface ActionRef<TInput = void> {
  readonly __brand: "ActionRef";
  readonly __inputType?: TInput;
  readonly name: string;
  intent: TInput extends void ? () => { action: string; input?: unknown } : (input: TInput) => { action: string; input?: unknown };
}

/**
 * Minimal ComputedRef interface (matches @manifesto-ai/builder)
 */
export interface ComputedRef<T = unknown> {
  readonly __brand: "ComputedRef";
  readonly __valueType?: T;
  readonly name: string;
}

/**
 * Minimal DomainModule interface (matches @manifesto-ai/builder)
 */
export interface DomainModule<
  TState = unknown,
  TComputed extends Record<string, ComputedRef<unknown>> = Record<string, ComputedRef<unknown>>,
  TActions extends Record<string, ActionRef<unknown>> = Record<string, ActionRef<unknown>>
> {
  readonly schema: { id: string; hash: string; [key: string]: unknown };
  readonly state: unknown;
  readonly computed: TComputed;
  readonly actions: TActions;
}

/**
 * Effect handler type (matches @manifesto-ai/host)
 */
export type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: { snapshot: unknown; requirement: unknown }
) => Promise<unknown[]>;

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Extract the state type from a DomainModule
 */
export type InferState<D> = D extends DomainModule<infer TState, any, any>
  ? TState
  : never;

/**
 * Extract computed ref names and their return types from a DomainModule
 */
export type InferComputed<D> = D extends DomainModule<any, infer TComputed, any>
  ? {
      [K in keyof TComputed]: TComputed[K] extends ComputedRef<infer V> ? V : never;
    }
  : never;

/**
 * Extract action names and their input types from a DomainModule
 */
export type InferActions<D> = D extends DomainModule<any, any, infer TActions>
  ? ActionDispatchers<TActions>
  : never;

/**
 * Convert ActionRef map to dispatcher functions
 *
 * ActionRef<void> -> () => Promise<void>
 * ActionRef<TInput> -> (input: TInput) => Promise<void>
 */
export type ActionDispatchers<TActions> = {
  [K in keyof TActions]: TActions[K] extends ActionRef<infer TInput>
    ? TInput extends void
      ? () => Promise<void>
      : (input: TInput) => Promise<void>
    : never;
};

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Options for createManifestoApp
 */
export interface ManifestoAppOptions<TState> {
  /**
   * Initial state for the domain
   */
  initialState: TState;

  /**
   * Optional actor reference (default: auto-generated)
   */
  actor?: ActorRef;

  /**
   * Optional authority policy (default: auto_approve)
   */
  authority?: AuthorityPolicy;

  /**
   * Optional projections to register
   */
  projections?: Projection[];

  /**
   * Optional effect handlers
   */
  effectHandlers?: Record<string, EffectHandler>;
}

// ============================================================================
// ManifestoApp Type
// ============================================================================

/**
 * The result of createManifestoApp
 *
 * Provides a Provider component and type-safe hooks.
 */
export interface ManifestoApp<
  TState,
  TComputed extends Record<string, unknown>,
  TActions extends Record<string, ActionRef<any>>
> {
  /**
   * Provider component that wraps your app
   */
  Provider: React.FC<{ children: ReactNode }>;

  /**
   * Access state values with a selector function
   *
   * @example
   * const todos = TodoApp.useValue(s => s.todos);
   */
  useValue: <T>(selector: (state: TState) => T) => T;

  /**
   * Access computed values with a selector function
   *
   * @example
   * const activeCount = TodoApp.useComputed(c => c.activeCount);
   */
  useComputed: <T>(selector: (computed: { [K in keyof TComputed]: TComputed[K] }) => T) => T;

  /**
   * Get all action dispatchers
   *
   * @example
   * const { add, toggle } = TodoApp.useActions();
   * await add({ title: "New Todo" });
   */
  useActions: () => ActionDispatchers<TActions>;

  /**
   * Escape hatch: access the underlying Bridge instance
   */
  useBridge: () => Bridge;
}
