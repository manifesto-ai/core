import type { z } from "zod";
import type { StateAccessor } from "../accessor/state-accessor.js";
import type { ComputedBuilder } from "../computed/computed-builder.js";
import type { ActionsBuilder } from "../actions/actions-builder.js";
import type { ExprBuilder } from "../expr/expr-builder.js";
import type { FlowBuilder } from "../flow/flow-builder.js";
import type { ComputedRef } from "../refs/computed-ref.js";
import type { ActionRef } from "../refs/action-ref.js";
import type { FlowRef } from "../refs/flow-ref.js";

/**
 * DomainContext - Context provided to the domain builder function
 *
 * Contains all the tools needed to define a domain:
 * - state: Type-safe accessor for state fields
 * - computed: Builder for computed values
 * - actions: Builder for actions
 * - expr: Expression DSL
 * - flow: Flow DSL
 *
 * TSchema is the Zod schema type (e.g., z.ZodObject<{...}>)
 */
export interface DomainContext<TSchema extends z.ZodTypeAny> {
  /**
   * Type-safe state accessor (preserves full Zod schema type)
   */
  readonly state: StateAccessor<TSchema>;

  /**
   * Computed value builder
   */
  readonly computed: ComputedBuilder;

  /**
   * Actions builder
   */
  readonly actions: ActionsBuilder;

  /**
   * Expression DSL
   */
  readonly expr: ExprBuilder;

  /**
   * Flow DSL
   */
  readonly flow: FlowBuilder;
}

/**
 * DomainOutput - What the builder function returns
 *
 * Note: ActionRef uses `any` instead of `unknown` to avoid contravariance issues
 * with the intent() method's function parameter type.
 */
export interface DomainOutput {
  readonly computed?: Record<string, ComputedRef<unknown>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly actions?: Record<string, ActionRef<any>>;
  readonly flows?: Record<string, FlowRef>;
}

/**
 * DomainOptions - Configuration for domain definition
 */
export interface DomainOptions {
  /**
   * Domain identifier (URI or UUID)
   * Auto-generated if omitted
   */
  readonly id?: string;

  /**
   * Semantic version
   * Defaults to "0.0.0-dev"
   */
  readonly version?: string;

  /**
   * Additional metadata
   */
  readonly meta?: {
    readonly name?: string;
    readonly description?: string;
    readonly authors?: string[];
  };
}
