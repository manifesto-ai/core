import { z } from "zod";
import type { DomainSchema, ActionSpec } from "@manifesto-ai/core";
import { toCanonical } from "@manifesto-ai/core";
import { buildAccessor } from "../accessor/accessor-builder.js";
import type { StateAccessor } from "../accessor/state-accessor.js";
import { createComputedBuilder, type ComputedBuilder } from "../computed/computed-builder.js";
import { createActionsBuilder, type ActionsBuilder } from "../actions/actions-builder.js";
import { expr } from "../expr/expr-builder.js";
import { flow } from "../flow/flow-builder.js";
import { guard, onceNull, onceNotSet } from "../flow/helpers.js";
import type { ComputedRef } from "../refs/computed-ref.js";
import type { ActionRef } from "../refs/action-ref.js";
import type { DomainContext, DomainOutput, DomainOptions } from "./domain-context.js";
import { zodToStateSpec, zodToFieldSpec } from "./zod-to-field-spec.js";
import type { DomainDiagnostics } from "../diagnostics/diagnostic-types.js";
import { createDiagnostics } from "../diagnostics/index.js";
import { sha256Sync } from "../utils/sha256.js";

/**
 * DomainModule - Complete domain output from defineDomain()
 *
 * Note: TActions uses `any` to avoid contravariance issues with ActionRef's intent() method.
 */
export interface DomainModule<
  TState,
  TComputed extends Record<string, ComputedRef<unknown>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TActions extends Record<string, ActionRef<any>>
> {
  /**
   * The compiled DomainSchema IR (for Core)
   */
  readonly schema: DomainSchema;

  /**
   * Type-safe state accessor
   */
  readonly state: StateAccessor<z.ZodObject<z.ZodRawShape>>;

  /**
   * Type-safe computed references
   */
  readonly computed: TComputed;

  /**
   * Type-safe action references
   */
  readonly actions: TActions;

  /**
   * Domain validation diagnostics
   */
  readonly diagnostics: DomainDiagnostics;
}

/**
 * Extended flow builder with helpers attached
 */
const flowWithHelpers = {
  ...flow,
  guard,
  onceNull,
  onceNotSet,
};

/**
 * defineDomain - Main entry point for domain definition
 *
 * Creates a type-safe domain with computed values and actions.
 *
 * @example
 * ```ts
 * const EventSchema = z.object({
 *   id: z.string(),
 *   status: z.enum(['pending', 'received', 'completed']),
 *   receivedAt: z.number().nullable(),
 * });
 *
 * const EventDomain = defineDomain(EventSchema, ({ state, computed, actions, flow, expr }) => {
 *   const { canReceive } = computed.define({
 *     canReceive: expr.and(
 *       expr.neq(state.status, 'completed'),
 *       expr.isNull(state.receivedAt)
 *     ),
 *   });
 *
 *   const { receive } = actions.define({
 *     receive: {
 *       available: canReceive,
 *       flow: flow.onceNull(state.receivedAt, ({ patch }) => {
 *         patch(state.receivedAt).set(expr.input('timestamp'));
 *       }),
 *     },
 *   });
 *
 *   return { computed: { canReceive }, actions: { receive } };
 * });
 * ```
 */
export function defineDomain<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TOut extends DomainOutput
>(
  stateSchema: TSchema,
  builder: (ctx: DomainContext<TSchema>) => TOut,
  options?: DomainOptions
): DomainModule<
  z.infer<TSchema>,
  TOut["computed"] extends Record<string, ComputedRef<unknown>>
    ? TOut["computed"]
    : Record<string, never>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TOut["actions"] extends Record<string, ActionRef<any>>
    ? TOut["actions"]
    : Record<string, never>
> {
  // Create builders
  const computedBuilder = createComputedBuilder();
  const actionsBuilder = createActionsBuilder();

  // Create state accessor
  const stateAccessor = buildAccessor(stateSchema);

  // Create context with proper typing
  const ctx: DomainContext<TSchema> = {
    state: stateAccessor as StateAccessor<TSchema>,
    computed: computedBuilder,
    actions: actionsBuilder,
    expr,
    flow: flowWithHelpers,
  };

  // Execute builder
  const output = builder(ctx);

  // Build specs
  const computedSpec = computedBuilder.buildSpec();
  const actionsSpec = actionsBuilder.buildSpec();

  // Convert to Core ActionSpec format
  const coreActionsSpec: Record<string, ActionSpec> = {};
  for (const [name, spec] of Object.entries(actionsSpec)) {
    coreActionsSpec[name] = {
      flow: spec.flow,
      input: spec.inputSchema ? zodToFieldSpec(spec.inputSchema) : undefined,
      available: spec.available,
      description: spec.description,
    };
  }

  // Generate domain ID if not provided
  const domainId = options?.id ?? `domain:${generateId()}`;
  const version = options?.version ?? "0.0.0-dev";

  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: domainId,
    version,
    types: {},
    state: zodToStateSpec(stateSchema),
    computed: {
      fields: Object.fromEntries(
        Object.entries(computedSpec).map(([name, spec]) => [
          name,
          {
            deps: spec.deps,
            expr: spec.expr,
            description: spec.description,
          },
        ])
      ),
    },
    actions: coreActionsSpec,
    meta: options?.meta,
  };
  const schemaHash = computeSchemaHash(schemaWithoutHash);

  // Build DomainSchema
  const schema: DomainSchema = {
    ...schemaWithoutHash,
    hash: schemaHash,
  };

  // Run diagnostics
  const diagnostics = createDiagnostics(stateSchema, computedBuilder, actionsBuilder);

  return {
    schema,
    state: stateAccessor,
    computed: (output.computed ?? {}) as TOut["computed"] extends Record<string, ComputedRef<unknown>>
      ? TOut["computed"]
      : Record<string, never>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: (output.actions ?? {}) as TOut["actions"] extends Record<string, ActionRef<any>>
      ? TOut["actions"]
      : Record<string, never>,
    diagnostics,
  };
}

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function computeSchemaHash(schema: Omit<DomainSchema, "hash">): string {
  const canonical = toCanonical(schema);
  return sha256Sync(canonical);
}
